;; CrisisEventManager.clar
;; Sophisticated contract for managing crisis events in a decentralized volunteer network.
;; Supports event creation with metadata, volunteer joining with skill matching, event updates,
;; status management, closing events, and querying. Includes access controls, limits, and timestamps.
;; Designed for integration with other contracts like VolunteerRegistry and HourLogging.

;; Constants
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-INVALID-EVENT u101)
(define-constant ERR-EVENT-CLOSED u102)
(define-constant ERR-MAX-VOLUNTEERS-REACHED u103)
(define-constant ERR-ALREADY-JOINED u104)
(define-constant ERR-INVALID-STATUS u105)
(define-constant ERR-INVALID-PARAMS u106)
(define-constant ERR-NOT-STARTED u107)
(define-constant ERR-ALREADY-ENDED u108)
(define-constant ERR-SKILL-MISMATCH u109)

(define-constant STATUS-OPEN "open")
(define-constant STATUS-ACTIVE "active")
(define-constant STATUS-CLOSED "closed")
(define-constant STATUS-CANCELLED "cancelled")

;; Data Maps
(define-map events
  { event-id: uint }
  {
    coordinator: principal,
    title: (string-utf8 100),
    description: (string-utf8 500),
    location: (string-utf8 200),  ;; e.g., "Latitude,Longitude" or address
    start-block: uint,
    end-block: (optional uint),
    status: (string-ascii 20),
    required-skills: (list 10 (string-utf8 50)),
    max-volunteers: uint,
    current-volunteers: uint,
    created-at: uint,
    tags: (list 5 (string-utf8 20))
  }
)

(define-map event-volunteers
  { event-id: uint, volunteer: principal }
  {
    joined-at: uint,
    role: (string-utf8 50),
    skills-provided: (list 5 (string-utf8 50))
  }
)

(define-map event-counter uint uint)  ;; Simple counter for event IDs, starting from 1

;; Private Functions
(define-private (increment-event-counter)
  (let ((current (default-to u0 (map-get? event-counter u0))))
    (map-set event-counter u0 (+ current u1))
    (+ current u1)
  )
)

(define-private (has-required-skills (required (list 10 (string-utf8 50))) (provided (list 5 (string-utf8 50))))
  (fold or-fold required (map list-contains provided required))
)

(define-private (list-contains (item (string-utf8 50)) (lst (list 10 (string-utf8 50))))
  (is-some (index-of lst item))
)

(define-private (or-fold (a bool) (b bool)) (or a b))

;; Public Functions

;; Create a new crisis event
(define-public (create-event
  (title (string-utf8 100))
  (description (string-utf8 500))
  (location (string-utf8 200))
  (start-block uint)
  (end-block (optional uint))
  (required-skills (list 10 (string-utf8 50)))
  (max-volunteers uint)
  (tags (list 5 (string-utf8 20)))
)
  (let
    ((event-id (increment-event-counter))
     (coordinator tx-sender))
    (if (or
          (is-eq (len title) u0)
          (is-eq (len description) u0)
          (> start-block block-height)
          (match end-block eb (< eb start-block) false)
          (is-eq max-volunteers u0))
        (err ERR-INVALID-PARAMS)
        (begin
          (map-set events
            { event-id: event-id }
            {
              coordinator: coordinator,
              title: title,
              description: description,
              location: location,
              start-block: start-block,
              end-block: end-block,
              status: STATUS-OPEN,
              required-skills: required-skills,
              max-volunteers: max-volunteers,
              current-volunteers: u0,
              created-at: block-height,
              tags: tags
            })
          (ok event-id)))
  ))

;; Join an event as a volunteer
(define-public (join-event (event-id uint) (role (string-utf8 50)) (skills-provided (list 5 (string-utf8 50))))
  (let
    (
      (event-opt (map-get? events { event-id: event-id }))
      (volunteer tx-sender)
    )
    (match event-opt event
      (if (or
            (not (is-eq (get status event) STATUS-OPEN))
            (>= (get current-volunteers event) (get max-volunteers event))
            (is-some (map-get? event-volunteers { event-id: event-id, volunteer: volunteer }))
            (not (has-required-skills (get required-skills event) skills-provided))
          )
          (err (if (not (is-eq (get status event) STATUS-OPEN)) ERR-EVENT-CLOSED
                 (if (>= (get current-volunteers event) (get max-volunteers event)) ERR-MAX-VOLUNTEERS-REACHED
                   (if (is-some (map-get? event-volunteers { event-id: event-id, volunteer: volunteer })) ERR-ALREADY-JOINED
                     ERR-SKILL-MISMATCH))))
          (begin
            (map-set event-volunteers
              { event-id: event-id, volunteer: volunteer }
              {
                joined-at: block-height,
                role: role,
                skills-provided: skills-provided
              }
            )
            (map-set events
              { event-id: event-id }
              (merge event { current-volunteers: (+ (get current-volunteers event) u1) })
            )
            (ok true)
          )
        )
      (err ERR-INVALID-EVENT)
    )
  )
)

;; Leave an event (before it starts)
(define-public (leave-event (event-id uint))
  (let
    (
      (event-opt (map-get? events { event-id: event-id }))
      (volunteer tx-sender)
      (vol-opt (map-get? event-volunteers { event-id: event-id, volunteer: volunteer }))
    )
    (match event-opt event
      (match vol-opt vol
        (if (or (not (is-eq (get status event) STATUS-OPEN)) (>= block-height (get start-block event)))
          (err ERR-NOT-STARTED)
          (begin
            (map-delete event-volunteers { event-id: event-id, volunteer: volunteer })
            (map-set events
              { event-id: event-id }
              (merge event { current-volunteers: (- (get current-volunteers event) u1) })
            )
            (ok true)
          )
        )
        (err ERR-UNAUTHORIZED)
      )
      (err ERR-INVALID-EVENT)
    )
  )
)

;; Update event details (only by coordinator, before start)
(define-public (update-event
  (event-id uint)
  (new-title (optional (string-utf8 100)))
  (new-description (optional (string-utf8 500)))
  (new-location (optional (string-utf8 200)))
  (new-end-block (optional uint))
  (new-max-volunteers (optional uint))
  (new-tags (optional (list 5 (string-utf8 20))))
)
  (let
    (
      (event-opt (map-get? events { event-id: event-id }))
    )
    (match event-opt event
      (if (or
            (not (is-eq (get coordinator event) tx-sender))
            (not (is-eq (get status event) STATUS-OPEN))
            (>= block-height (get start-block event))
          )
          (err ERR-UNAUTHORIZED)
          (let
            (
              (updated-event
                (merge event
                  {
                    title: (default-to (get title event) new-title),
                    description: (default-to (get description event) new-description),
                    location: (default-to (get location event) new-location),
                    end-block: (default-to (get end-block event) new-end-block),
                    max-volunteers: (default-to (get max-volunteers event) new-max-volunteers),
                    tags: (default-to (get tags event) new-tags)
                  }
                )
              )
            )
            (map-set events { event-id: event-id } updated-event)
            (ok true)
          )
        )
      (err ERR-INVALID-EVENT)
    )
  )
)

;; Close or cancel an event (only by coordinator)
(define-public (close-event (event-id uint) (new-status (string-ascii 20)))
  (let
    (
      (event-opt (map-get? events { event-id: event-id }))
    )
    (match event-opt event
      (if (or
            (not (is-eq (get coordinator event) tx-sender))
            (not (or (is-eq new-status STATUS-CLOSED) (is-eq new-status STATUS-CANCELLED)))
            (is-eq (get status event) new-status)
          )
          (err (if (not (is-eq (get coordinator event) tx-sender)) ERR-UNAUTHORIZED ERR-INVALID-STATUS))
          (begin
            (map-set events
              { event-id: event-id }
              (merge event { status: new-status, end-block: (some block-height) })
            )
            (ok true)
          )
        )
      (err ERR-INVALID-EVENT)
    )
  )
)

;; Activate an event (auto or manual, but here manual for sophistication)
(define-public (activate-event (event-id uint))
  (let
    (
      (event-opt (map-get? events { event-id: event-id }))
    )
    (match event-opt event
      (if (or
            (not (is-eq (get coordinator event) tx-sender))
            (not (is-eq (get status event) STATUS-OPEN))
            (< block-height (get start-block event))
          )
          (err ERR-UNAUTHORIZED)
          (begin
            (map-set events
              { event-id: event-id }
              (merge event { status: STATUS-ACTIVE })
            )
            (ok true)
          )
        )
      (err ERR-INVALID-EVENT)
    )
  )
)

;; Read-Only Functions

;; Get event details
(define-read-only (get-event-details (event-id uint))
  (map-get? events { event-id: event-id })
)

;; Get volunteers for an event
(define-read-only (get-event-volunteers (event-id uint) (volunteer principal))
  (map-get? event-volunteers { event-id: event-id, volunteer: volunteer })
)

;; Check if volunteer is joined
(define-read-only (is-volunteer-joined (event-id uint) (volunteer principal))
  (is-some (map-get? event-volunteers { event-id: event-id, volunteer: volunteer }))
)

;; Get total events count
(define-read-only (get-total-events)
  (default-to u0 (map-get? event-counter u0))
)

;; Get events by status (simple filter, but since no loops in read-only, return all and filter off-chain)
;; For sophistication, could add more indices, but keep simple.