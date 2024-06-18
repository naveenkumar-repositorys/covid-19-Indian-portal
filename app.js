const express = require("express");
let path = require("path");
let { open } = require("sqlite");
let sqlite3 = require("sqlite3");
let bcrypt = require("bcrypt");
let jwt = require("jsonwebtoken");

let app = express();
let dbPath = path.join(__dirname, "covid19IndiaPortal.db");
db = null;
app.use(express.json());

//functions
let convertedDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

let convertedDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

let initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db Error:${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//API-1

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let findUserQuery = `SELECT * FROM user
        WHERE username = "${username}";`;
  let dbResponse = await db.get(findUserQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let isPassword = await bcrypt.compare(password, dbResponse.password);
    if (isPassword === true) {
      const payload = {
        username: username,
      };
      let jwtToken = jwt.sign(payload, "xxyyzz");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

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
    jwt.verify(jwtToken, "xxyyzz", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API-2

app.get("/states/", authenticateToken, async (request, response) => {
  let allStatesQuery = `SELECT * FROM state;`;
  let dbObject = await db.all(allStatesQuery);
  let responseObject = dbObject.map((eachObject) =>
    convertedDbObjectToResponseObject(eachObject)
  );
  console.log(responseObject);
  response.send(responseObject);
});

//API-3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  let { stateId } = request.params;
  let allStatesQuery = `SELECT * FROM state
    WHERE state_id = ${stateId};`;
  let dbObject = await db.get(allStatesQuery);
  let responseObject = convertedDbObjectToResponseObject(dbObject);

  //console.log(responseObject);
  response.send(responseObject);
});

//API-4

app.post("/districts/", authenticateToken, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictStatusQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES( "${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
  let dbObject = await db.run(updateDistrictStatusQuery);
  //console.log(dbObject);
  response.send("District Successfully Added");
});

//API-5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    let onlyDistrictQuery = `SELECT * FROM district
    WHERE district_id = ${districtId};`;
    let dbObject = await db.get(onlyDistrictQuery);
    let responseObject = convertedDistrictDbObjectToResponseObject(dbObject);
    console.log(responseObject);
    response.send(responseObject);
  }
);

//API-6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    let delDistrictQuery = `DELETE FROM district
    WHERE district_id = ${districtId};`;
    let dbObject = await db.run(delDistrictQuery);
    console.log(dbObject);
    response.send("District Removed");
  }
);

//API-7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    let { districtId } = request.params;
    let updateDistrictQuery = `UPDATE district
    SET district_name= "${districtName}",
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active= ${active},
        deaths=${deaths}
    WHERE district_id = ${districtId};`;
    let dbObject = await db.run(updateDistrictQuery);
    console.log(dbObject);
    response.send("District Details Updated");
  }
);

//API-8

app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    let { stateId } = request.params;
    let allStatesQuery = `SELECT sum(cases)AS totalCases,
        sum(cured)AS totalCured,
        sum(active)AS totalActive,
        sum(deaths)AS totalDeaths

   FROM state NATURAL JOIN district
   WHERE state_id = ${stateId};`;
    let dbObject = await db.get(allStatesQuery);
    console.log(dbObject);
    response.send(dbObject);
  }
);

module.exports = app;
