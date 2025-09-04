import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface EventData {
  coordinator: string;
  title: string;
  description: string;
  location: string;
  startBlock: number;
  endBlock: number | null;
  status: string;
  requiredSkills: string[];
  maxVolunteers: number;
  currentVolunteers: number;
  createdAt: number;
  tags: string[];
}

interface VolunteerData {
  joinedAt: number;
  role: string;
  skillsProvided: string[];
}

interface ContractState {
  events: Map<number, EventData>;
  eventVolunteers: Map<string, VolunteerData>; // Key: `${eventId}-${volunteer}`
  eventCounter: number;
  blockHeight: number; // Mocked block height
}

// Mock contract implementation
class CrisisEventManagerMock {
  private state: ContractState = {
    events: new Map(),
    eventVolunteers: new Map(),
    eventCounter: 0,
    blockHeight: 1000, // Starting mock block height
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_EVENT = 101;
  private ERR_EVENT_CLOSED = 102;
  private ERR_MAX_VOLUNTEERS_REACHED = 103;
  private ERR_ALREADY_JOINED = 104;
  private ERR_INVALID_STATUS = 105;
  private ERR_INVALID_PARAMS = 106;
  private ERR_NOT_STARTED = 107;
  private ERR_SKILL_MISMATCH = 109;

  private STATUS_OPEN = "open";
  private STATUS_ACTIVE = "active";
  private STATUS_CLOSED = "closed";
  private STATUS_CANCELLED = "cancelled";

  // Helper to advance block height
  advanceBlockHeight(blocks: number) {
    this.state.blockHeight += blocks;
  }

  createEvent(
    caller: string,
    title: string,
    description: string,
    location: string,
    startBlock: number,
    endBlock: number | null,
    requiredSkills: string[],
    maxVolunteers: number,
    tags: string[]
  ): ClarityResponse<number> {
    if (
      title.length === 0 ||
      description.length === 0 ||
      startBlock <= this.state.blockHeight ||
      (endBlock !== null && endBlock < startBlock) ||
      maxVolunteers === 0
    ) {
      return { ok: false, value: this.ERR_INVALID_PARAMS };
    }
    const eventId = ++this.state.eventCounter;
    this.state.events.set(eventId, {
      coordinator: caller,
      title,
      description,
      location,
      startBlock,
      endBlock,
      status: this.STATUS_OPEN,
      requiredSkills,
      maxVolunteers,
      currentVolunteers: 0,
      createdAt: this.state.blockHeight,
      tags,
    });
    return { ok: true, value: eventId };
  }

  joinEvent(
    caller: string,
    eventId: number,
    role: string,
    skillsProvided: string[]
  ): ClarityResponse<boolean> {
    const event = this.state.events.get(eventId);
    if (!event) return { ok: false, value: this.ERR_INVALID_EVENT };
    if (event.status !== this.STATUS_OPEN) return { ok: false, value: this.ERR_EVENT_CLOSED };
    if (event.currentVolunteers >= event.maxVolunteers) return { ok: false, value: this.ERR_MAX_VOLUNTEERS_REACHED };
    const volKey = `${eventId}-${caller}`;
    if (this.state.eventVolunteers.has(volKey)) return { ok: false, value: this.ERR_ALREADY_JOINED };
    const hasSkills = event.requiredSkills.some(skill => skillsProvided.includes(skill));
    if (!hasSkills) return { ok: false, value: this.ERR_SKILL_MISMATCH };
    this.state.eventVolunteers.set(volKey, {
      joinedAt: this.state.blockHeight,
      role,
      skillsProvided,
    });
    event.currentVolunteers++;
    return { ok: true, value: true };
  }

  leaveEvent(caller: string, eventId: number): ClarityResponse<boolean> {
    const event = this.state.events.get(eventId);
    if (!event) return { ok: false, value: this.ERR_INVALID_EVENT };
    const volKey = `${eventId}-${caller}`;
    const vol = this.state.eventVolunteers.get(volKey);
    if (!vol) return { ok: false, value: this.ERR_UNAUTHORIZED };
    if (event.status !== this.STATUS_OPEN || this.state.blockHeight >= event.startBlock) {
      return { ok: false, value: this.ERR_NOT_STARTED };
    }
    this.state.eventVolunteers.delete(volKey);
    event.currentVolunteers--;
    return { ok: true, value: true };
  }

  updateEvent(
    caller: string,
    eventId: number,
    newTitle: string | null,
    newDescription: string | null,
    newLocation: string | null,
    newEndBlock: number | null,
    newMaxVolunteers: number | null,
    newTags: string[] | null
  ): ClarityResponse<boolean> {
    const event = this.state.events.get(eventId);
    if (!event) return { ok: false, value: this.ERR_INVALID_EVENT };
    if (event.coordinator !== caller || event.status !== this.STATUS_OPEN || this.state.blockHeight >= event.startBlock) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newTitle) event.title = newTitle;
    if (newDescription) event.description = newDescription;
    if (newLocation) event.location = newLocation;
    if (newEndBlock !== null) event.endBlock = newEndBlock;
    if (newMaxVolunteers !== null) event.maxVolunteers = newMaxVolunteers;
    if (newTags) event.tags = newTags;
    return { ok: true, value: true };
  }

  closeEvent(caller: string, eventId: number, newStatus: string): ClarityResponse<boolean> {
    const event = this.state.events.get(eventId);
    if (!event) return { ok: false, value: this.ERR_INVALID_EVENT };
    if (event.coordinator !== caller || ![this.STATUS_CLOSED, this.STATUS_CANCELLED].includes(newStatus) || event.status === newStatus) {
      return { ok: false, value: this.ERR_UNAUTHORIZED }; // Simplified error
    }
    event.status = newStatus;
    event.endBlock = this.state.blockHeight;
    return { ok: true, value: true };
  }

  activateEvent(caller: string, eventId: number): ClarityResponse<boolean> {
    const event = this.state.events.get(eventId);
    if (!event) return { ok: false, value: this.ERR_INVALID_EVENT };
    if (event.coordinator !== caller || event.status !== this.STATUS_OPEN || this.state.blockHeight < event.startBlock) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    event.status = this.STATUS_ACTIVE;
    return { ok: true, value: true };
  }

  getEventDetails(eventId: number): ClarityResponse<EventData | null> {
    return { ok: true, value: this.state.events.get(eventId) ?? null };
  }

  getEventVolunteers(eventId: number, volunteer: string): ClarityResponse<VolunteerData | null> {
    const volKey = `${eventId}-${volunteer}`;
    return { ok: true, value: this.state.eventVolunteers.get(volKey) ?? null };
  }

  isVolunteerJoined(eventId: number, volunteer: string): ClarityResponse<boolean> {
    const volKey = `${eventId}-${volunteer}`;
    return { ok: true, value: this.state.eventVolunteers.has(volKey) };
  }

  getTotalEvents(): ClarityResponse<number> {
    return { ok: true, value: this.state.eventCounter };
  }
}

// Test setup
const accounts = {
  coordinator: "coordinator",
  volunteer1: "volunteer1",
  volunteer2: "volunteer2",
  unauthorized: "unauthorized",
};

describe("CrisisEventManager Contract", () => {
  let contract: CrisisEventManagerMock;

  beforeEach(() => {
    contract = new CrisisEventManagerMock();
    vi.resetAllMocks();
  });

  it("should create a new event successfully", () => {
    const createResult = contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical", "logistics"],
      50,
      ["disaster", "flood"]
    );
    expect(createResult).toEqual({ ok: true, value: 1 });

    const eventDetails = contract.getEventDetails(1);
    expect(eventDetails.ok).toBe(true);
    expect(eventDetails.value).toMatchObject({
      coordinator: accounts.coordinator,
      title: "Flood Response",
      status: "open",
      currentVolunteers: 0,
    });
  });

  it("should prevent event creation with invalid params", () => {
    const createResult = contract.createEvent(
      accounts.coordinator,
      "",
      "Description",
      "Location",
      1010,
      1100,
      [],
      50,
      []
    );
    expect(createResult).toEqual({ ok: false, value: 106 });
  });

  it("should allow volunteer to join event", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const joinResult = contract.joinEvent(
      accounts.volunteer1,
      1,
      "Medic",
      ["medical"]
    );
    expect(joinResult).toEqual({ ok: true, value: true });

    const isJoined = contract.isVolunteerJoined(1, accounts.volunteer1);
    expect(isJoined).toEqual({ ok: true, value: true });

    const eventDetails = contract.getEventDetails(1);
    expect(eventDetails.value?.currentVolunteers).toBe(1);
  });

  it("should prevent joining with skill mismatch", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const joinResult = contract.joinEvent(
      accounts.volunteer1,
      1,
      "Helper",
      ["logistics"]
    );
    expect(joinResult).toEqual({ ok: false, value: 109 });
  });

  it("should allow volunteer to leave event before start", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );
    contract.joinEvent(accounts.volunteer1, 1, "Medic", ["medical"]);

    const leaveResult = contract.leaveEvent(accounts.volunteer1, 1);
    expect(leaveResult).toEqual({ ok: true, value: true });

    const isJoined = contract.isVolunteerJoined(1, accounts.volunteer1);
    expect(isJoined).toEqual({ ok: true, value: false });
  });

  it("should prevent leaving after event start", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );
    contract.joinEvent(accounts.volunteer1, 1, "Medic", ["medical"]);
    contract.advanceBlockHeight(20); // Now blockHeight = 1020 > 1010

    const leaveResult = contract.leaveEvent(accounts.volunteer1, 1);
    expect(leaveResult).toEqual({ ok: false, value: 107 });
  });

  it("should allow coordinator to update event before start", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const updateResult = contract.updateEvent(
      accounts.coordinator,
      1,
      "Updated Title",
      null,
      null,
      null,
      null,
      null
    );
    expect(updateResult).toEqual({ ok: true, value: true });

    const eventDetails = contract.getEventDetails(1);
    expect(eventDetails.value?.title).toBe("Updated Title");
  });

  it("should prevent unauthorized update", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const updateResult = contract.updateEvent(
      accounts.unauthorized,
      1,
      "Hacked Title",
      null,
      null,
      null,
      null,
      null
    );
    expect(updateResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow coordinator to close event", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const closeResult = contract.closeEvent(accounts.coordinator, 1, "closed");
    expect(closeResult).toEqual({ ok: true, value: true });

    const eventDetails = contract.getEventDetails(1);
    expect(eventDetails.value?.status).toBe("closed");
  });

  it("should allow coordinator to activate event after start", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );
    contract.advanceBlockHeight(10); // blockHeight = 1010

    const activateResult = contract.activateEvent(accounts.coordinator, 1);
    expect(activateResult).toEqual({ ok: true, value: true });

    const eventDetails = contract.getEventDetails(1);
    expect(eventDetails.value?.status).toBe("active");
  });

  it("should prevent activation before start", () => {
    contract.createEvent(
      accounts.coordinator,
      "Flood Response",
      "Help with flood relief",
      "City, Country",
      1010,
      1100,
      ["medical"],
      50,
      ["disaster"]
    );

    const activateResult = contract.activateEvent(accounts.coordinator, 1);
    expect(activateResult).toEqual({ ok: false, value: 100 });
  });
});