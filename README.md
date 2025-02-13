# FleetForce - Fleet Intelligence Prototype

A lightweight prototype that demonstrates:
- **React** frontend (TripList and ExploreRoute pages)
- **FastAPI** backend (APIs for trips, stops, tractor trips)
- **Postgres** database storing trip and stop data
- **MapLibre** and **MUI**-based UI components
- Basic filtering and playback of truck routes

## Table of Contents
1. [Folder Structure](#folder-structure)
2. [Prerequisites](#prerequisites)
3. [Setup & Installation](#setup--installation)
4. [Running Locally](#running-locally)
5. [Deployment](#deployment)
6. [Usage & Highlights](#usage--highlights)
7. [Troubleshooting](#troubleshooting)
8. [License](#license)

---

## Folder Structure

fleetforce/
│
├── backend/
│   ├── main.py            # FastAPI entry point
│   ├── database.py        # SQLAlchemy/Async DB config
│   ├── models.py          # DB models if any
│   └── ...
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PlaybackControls.js
│   │   │   ├── MapControls.js
│   │   │   ├── ViewRoute.js
│   │   │   └── ViewMetric.js
│   │   ├── pages/
│   │   │   ├── TripsList.js
│   │   │   └── ExploreRoute.js
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── docker-compose.yml    # (Optional) if you containerize
└── README.md             # This file

## Prerequisites

1. **Node.js** (v14+ recommended) and **npm** or **yarn** for building the React front end.
2. **Python 3.9+** and [**pip**](https://pip.pypa.io) for installing FastAPI and related packages.
3. A **Postgres** database (can be local Docker or remote).
4. (Optional) [**Docker**](https://www.docker.com/) & [**Docker Compose**](https://docs.docker.com/compose/) if you want container-based deployment.

---

## Setup & Installation

1. **Clone** this repository:
   ```bash
   git clone https://your-org.example.com/fleet-intelligence-prototype.git
   cd fleet-intelligence-prototype