# ElectroMania Backend

Backend API for the ElectroMania educational game built with Express.js and MongoDB.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your values:
- Set `MONGODB_URI` to your MongoDB connection string
- Set `JWT_SECRET` to a secure random string
- Adjust other settings as needed

4. Start MongoDB (if running locally):
```bash
mongod
```

5. Seed challenges (optional):
```bash
node scripts/seedChallenges.js
```

6. Start the server:
```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Challenges

- `GET /api/challenges` - Get all challenges
- `GET /api/challenges/:id` - Get single challenge
- `POST /api/challenges` - Create challenge (protected)
- `PUT /api/challenges/:id` - Update challenge (protected)
- `DELETE /api/challenges/:id` - Delete challenge (protected)
- `POST /api/challenges/:id/complete` - Mark challenge as completed (protected)

### Sandbox

- `GET /api/sandbox` - Get all user sandbox saves (protected)
- `GET /api/sandbox/autosave` - Get autosave (protected)
- `POST /api/sandbox/autosave` - Create/update autosave (protected)
- `GET /api/sandbox/:id` - Get specific save (protected)
- `POST /api/sandbox` - Create new save (protected)
- `PUT /api/sandbox/:id` - Update save (protected)
- `DELETE /api/sandbox/:id` - Delete save (protected)

### User Progress

- `GET /api/users/progress` - Get user progress (protected)
- `PUT /api/users/progress` - Update user progress (protected)

## Data Models

### User
- username, email, password
- completedChallenges (array with challengeId, completedAt, score)
- currentChallengeIndex

### Challenge
- prompt, requiredComponents (array), theory (array)
- order, difficulty, points, isActive

### Sandbox
- userId, name, components (array), cameraPosition
- isAutoSave (for automatic saves)

## Authentication

JWT tokens are used for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```
