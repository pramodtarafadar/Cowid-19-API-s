const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//Authentication middleware Function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "azbycx", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// 1 Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getDbUSer = `
  SELECT
    *
  FROM
    user
  WHERE
    username LIKE '${username}'`;
  const dbUser = await db.get(getDbUSer);
  if (dbUser !== undefined) {
    const isPasswordSame = await bcrypt.compare(password, dbUser.password);
    if (isPasswordSame !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      let payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "azbycx");
      response.send({ jwtToken });
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// 2 Get States API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT
    state_id AS stateId,
    state_name AS stateName,
    population AS population
  FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

// 3 Get State API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
  SELECT
    state_id AS stateId,
    state_name AS stateName,
    population AS population
  FROM state
  WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

// 4 Post Dist API

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES
    ('${districtName}',
    '${stateId}',
    '${cases}',
    '${cured}',
    '${active}',
    '${deaths}');`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//5 Get Dist API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
    FROM district
    WHERE
        district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

//6 Delete Dist API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE
        district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//7 Update Dist API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    UPDATE district
    SET district_name='${districtName}',
        state_id='${stateId}',
        cases='${cases}',
        cured='${cured}',
        active='${active}',
        deaths='${deaths}'
    WHERE
        district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//8 GET State Stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM
        district
    WHERE
        district.state_id = ${stateId};`;
    const stateStats = await db.get(getStateStatsQuery);
    response.send(stateStats);
  }
);

module.exports = app;
