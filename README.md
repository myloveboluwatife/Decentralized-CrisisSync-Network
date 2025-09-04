# 🌍 Decentralized CrisisSync Network

Welcome to a decentralized platform revolutionizing global crisis response! This Web3 project uses the Stacks blockchain and Clarity smart contracts to coordinate volunteers, log verifiable hours on-chain, and reward participants with tokens for their efforts in real-world crises like natural disasters, humanitarian aid, or environmental emergencies.

By tokenizing volunteer contributions, we solve key problems in traditional coordination: lack of transparency, inefficient reward distribution, verification challenges, and centralized control that often excludes global participants. Volunteers earn transferable tokens based on logged hours, which can be redeemed for goods, services, or donations, incentivizing sustained involvement.

## ✨ Features

🌐 Global crisis event creation and volunteer matching  
🕒 On-chain logging of volunteer hours with immutable timestamps  
💰 Token rewards proportional to verified contributions  
✅ Multi-party verification to prevent fraud  
🤝 Decentralized governance for network rules and upgrades  
📊 Reputation system to build trust among participants  
💸 Donation pooling to fund rewards  
🔒 Secure registration for volunteers and coordinators  

## 🛠 How It Works

**For Volunteers**  
- Register on the network with your wallet.  
- Browse active crisis events and sign up.  
- Log your hours via the hour-logging contract, attaching proofs (e.g., hashes of photos or reports).  
- Once verified, claim reward tokens based on hours contributed.  

**For Coordinators (e.g., NGOs or Crisis Organizers)**  
- Create a new crisis event with details like location, type, and required skills.  
- Verify submitted volunteer hours through multi-signature approval.  
- Distribute pooled donations as token rewards.  

**For Donors**  
- Contribute STX or tokens to a crisis event's reward pool.  
- Track how funds are used via on-chain transparency.  

**Reward Mechanism**  
- Tokens are minted and distributed based on verified hours (e.g., 1 token per hour).  
- Volunteers can stake tokens for governance voting or higher reputation.  

This setup ensures tamper-proof records, reduces administrative overhead, and fosters a self-sustaining ecosystem for global good.

## 📜 Smart Contracts (in Clarity)

The project leverages 8 interconnected Clarity smart contracts on the Stacks blockchain for security, scalability, and Bitcoin-anchored finality. Here's an overview:

1. **VolunteerRegistry.clar**  
   - Handles user registration, profile storage (e.g., skills, location hash), and reputation scores.  
   - Functions: `register-volunteer`, `update-profile`, `get-reputation`.  

2. **CrisisEventManager.clar**  
   - Creates and manages crisis events with metadata (e.g., start/end dates, description).  
   - Functions: `create-event`, `join-event`, `close-event`.  

3. **HourLogging.clar**  
   - Allows volunteers to log hours with proof hashes and event IDs.  
   - Functions: `log-hours`, `get-logged-hours`.  

4. **VerificationEngine.clar**  
   - Multi-party verification for logged hours (e.g., coordinator approvals or oracle integration).  
   - Functions: `submit-verification`, `approve-log`, `dispute-log`.  

5. **RewardToken.clar**  
   - SIP-10 compliant fungible token for rewards (minting based on verified hours).  
   - Functions: `mint-tokens`, `transfer`, `balance-of`.  

6. **DonationPool.clar**  
   - Manages donation pools per event, converting STX to reward tokens.  
   - Functions: `donate`, `withdraw-for-rewards`, `get-pool-balance`.  

7. **GovernanceDAO.clar**  
   - Token-based voting for network proposals (e.g., reward rates, upgrades).  
   - Functions: `propose-change`, `vote`, `execute-proposal`.  

8. **ReputationTracker.clar**  
   - Tracks and updates volunteer reputation based on verified contributions and disputes.  
   - Functions: `update-reputation`, `query-reputation`.  

These contracts interact seamlessly: e.g., HourLogging calls VerificationEngine, which triggers RewardToken minting upon approval.

## 🚀 Getting Started

1. Set up a Stacks wallet (e.g., Hiro Wallet).  
2. Deploy the contracts using Clarinet for local testing.  
3. Interact via the Stacks explorer or build a frontend dApp.  

Join the movement to make crisis response more equitable and efficient! 🚀
