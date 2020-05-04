// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
const compression = require('compression');
const fs = require('fs');
const url = require('url');
const uuid = require('uuid/v4');
const AWS = require('aws-sdk');

//const express = require('express');
//const bodyParser = require('body-parser');
const mysql = require('mysql');

var pool = mysql.createPool({
  connectionLimit: 100, //important
  host: '0.0.0.0',
  user: 'root',
  password: 'admin123',
  database: 'etreat',
  debug: false
});


//const mysql = require('./server_mysql.js');
/* eslint-enable */

//let hostname = '127.0.0.1';
//let hostname = '192.168.2.23';
let hostname = '0.0.0.0';
let port = 8080;
let protocol = 'http';
let options = {};

const chime = new AWS.Chime({
  region: 'us-east-1'
});
chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com/console');
//chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com/console');

const meetingCache = {};
const attendeeCache = {};

const log = message => {
  console.log(`${new Date().toISOString()} ${message}`);
};

//const app = process.env.npm_config_app || 'etreat';
const app = 'etreat';

const server = require(protocol).createServer(options, async (request, response) => {
  log(`${request.method} ${request.url} BEGIN`);
  compression({})(request, response, () => {});
  try {
    if (request.method === 'GET' && (request.url === '/' || request.url.startsWith('/?'))) {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html');
      response.end(fs.readFileSync(`dist/${app}.html`));
    } else if (request.method === 'POST' && request.url.startsWith('/join?')) {
      const query = url.parse(request.url, true).query;
      const title = query.title;
      const name = query.name;
      if (!meetingCache[title]) {
        meetingCache[title] = await chime
          .createMeeting({
            ClientRequestToken: uuid(),
            // NotificationsConfiguration: {
            //   SqsQueueArn: 'Paste your arn here',
            //   SnsTopicArn: 'Paste your arn here'
            // }
          })
          .promise();
        attendeeCache[title] = {};
      }
      const joinInfo = {
        JoinInfo: {
          Title: title,
          Meeting: meetingCache[title].Meeting,
          Attendee: (
            await chime
            .createAttendee({
              MeetingId: meetingCache[title].Meeting.MeetingId,
              ExternalUserId: uuid(),
            })
            .promise()
          ).Attendee,
        },
      };
      attendeeCache[title][joinInfo.JoinInfo.Attendee.AttendeeId] = name;
      response.statusCode = 201;
      response.setHeader('Content-Type', 'application/json');
      response.write(JSON.stringify(joinInfo), 'utf8');
      response.end();
      log(JSON.stringify(joinInfo, null, 2));
    } else if (request.method === 'GET' && request.url.startsWith('/attendee?')) {
      const query = url.parse(request.url, true).query;
      const attendeeInfo = {
        AttendeeInfo: {
          AttendeeId: query.attendee,
          Name: attendeeCache[query.title][query.attendee],
        },
      };
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.write(JSON.stringify(attendeeInfo), 'utf8');
      response.end();
      log(JSON.stringify(attendeeInfo, null, 2));
    } else if (request.method === 'POST' && request.url.startsWith('/meeting?')) {
      const query = url.parse(request.url, true).query;
      const title = query.title;
      if (!meetingCache[title]) {
        meetingCache[title] = await chime
          .createMeeting({
            ClientRequestToken: uuid(),
            // NotificationsConfiguration: {
            //   SqsQueueArn: 'Paste your arn here',
            //   SnsTopicArn: 'Paste your arn here'
            // }
          })
          .promise();
        attendeeCache[title] = {};
      }
      const joinInfo = {
        JoinInfo: {
          Title: title,
          Meeting: meetingCache[title].Meeting,
        },
      };
      response.statusCode = 201;
      response.setHeader('Content-Type', 'application/json');
      response.write(JSON.stringify(joinInfo), 'utf8');
      response.end();
      log(JSON.stringify(joinInfo, null, 2));
    } else if (request.method === 'POST' && request.url.startsWith('/end?')) {
      const query = url.parse(request.url, true).query;
      const title = query.title;
      await chime
        .deleteMeeting({
          MeetingId: meetingCache[title].Meeting.MeetingId,
        })
        .promise();
      response.statusCode = 200;
      response.end();
    } else if (request.method === 'GET' && request.url.startsWith('/getAllPatient')) {
      //log(CircularJSON.stringify(response, null, 2));
      //log(request.getHeader());
      response.statusCode = 201;
      response.setHeader('Content-Type', 'application/json');
      search_all(request, response);
	//mysql.search_all(request, response);
	//test(request, response);
      //response.end();
      log("response sent")

      //log(response.getHeader());
    } else {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain');
      response.end('404 Not Found');
    }
  } catch (err) {
    log(`server caught error: ${err}`);
    response.statusCode = 403;
    response.setHeader('Content-Type', 'application/json');
    response.write(JSON.stringify({
      error: err.message
    }), 'utf8');
    response.end();
  }
  log(`${request.method} ${request.url} END`);
});

server.listen(port, hostname, () => {
  log(`server running at ${protocol}://${hostname}:${port}/`);
});
//--------------------other functions------------------------//


function search_all(req, res) {
  pool.getConnection(function(err, connection) {
    if (err) {
      res.json({
        "code": 100,
        "status": "Error in connection database"
      });
      return;
    }
    console.log('connected as id ' + connection.threadId);

    connection.query("SELECT s.id_patient ID, concat(p.last_name, ', ', p.first_name) 'Patient Name', DATE_FORMAT(p.birth_date, \"%Y-%m-%d\") 'Date of Birth', DATE_FORMAT(service_date, \"%Y-%m-%d\") 'Date of Service', f.name Facility, chief_complaint 'Chief Complaint', HPI, interval_history 'Interval History', review_of_systems 'Review Of System', medical_history 'Past Medical History', medication 'Medications', physical_examination 'Physical Examination', assessment 'Assessment', plan Plan FROM etreat.Service as s ,etreat.Patient as p , etreat.facility as f where s.id_patient = p.id_patient and s.id_facility = f.id", function(err, rows) {
    //connection.query("SELECT * FROM etreat.facility ", function(err, rows) {
    //connection.query("SELECT * FROM etreat.Service ", function(err, rows) {

      console.log("before res = " + rows);

      connection.release();
      if (!err) {
        //res.json(rows);

        console.log("before res = " + JSON.stringify(rows));

        //res.write(JSON.stringify(rows), null, function(){res.end()});
        res.write(JSON.stringify(rows), 'utf8');
        res.end();
        //log("res = " + JSON.stringify(rows));
      }
    });
    connection.on('error', function(err) {
      //res.json({
       // "code": 100,
      //  "status": "Error in connection database"
      //});
        console.log("Error = " + err);
      return;
    });
  });
}
//-------------------- test ------------//

function test(req, res) {
  //res.write('<html><body><p>This is student Page.</p></body></html>', 'utf8');
  var patient_list = [{
      "ID": 1,
      "Patient Name": "Koetscha, Bernard",
      "Date of Birth": "8/14/1947",
      "Date of Service": "11/18/2019",
      "Facility": "Chamberlain Healthcare Manor",
      "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to the presence of left artificial hip joint.",
      "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going pretty good.",
      "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
      "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative",
      "Past Medical History": "BPH, bipolar, hypercholesteremia, benign essential tremor, CVA, PVD, depression, Afib, CAD, MI s/p stents, arthritis, s/p R THR.",
      "Medications": "As per MAR (reviewed pertinent medications today)",
      "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM in the LLE at the hip secondary to joint replacement, both passive and active. Right is intact in full ROM. Muscle tone and sensation are intact. No LE edema. Proprioception is intact. Has abnormal gait during ambulation. Has 3/5 strength of LE and 4/5 strength of UE.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
      "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint",
      "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness. Continue working on quad sets, ankle pumps and transfers.\n2. Current level of function: Amb 15'x2, 40', 60' with CGA and RW; sit/stand with vc's for hand placements from elevated surfaces; \n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
    },
    {
      "ID": 2,
      "Patient Name": "Sherbacka, Joyce",
      "Date of Birth": "10/26/1943",
      "Date of Service": "11/18/2019",
      "Facility": "Chamberlain Healthcare Manor",
      "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to unspecified subluxation of right hip, subsequent encounter, unspecified injury of right hip, subsequent encounter",
      "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
      "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, difficulty walking. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
      "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
      "Past Medical History": "Cystocele, glaucoma, HTN, hx chemotherapy, active smoker, \" mild mental retardation\", left breast Ca, hydronephrosis, closed nondisplaced fx of shaft of left clavicle, wrist fx, cataract extraction w/intraocular lens implant, simple mastectomy, sentinel lymph node biopsy, eye surgery, US-guided breast biopsy, lymph node dissection/axillary node dissection.",
      "Medications": "As per MAR (reviewed pertinent medications today)",
      "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough\nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM of the right hip secondary to dislocation. Flexion and extension, adduction and abduction. Has abnormal gait during ambulation. Has 3/5 strength of LE and 3/5 strength of UE. No LE edema.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
      "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. S73.001D Unspecified subluxation of right hip, subsequent encounter5. S79.911D Unspecified injury of right hip, subsequent encounter",
      "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, difficulty walking. Continue working on ankle pumps, transfers and quad sets.\n2. Current level of function: No rehab updates\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
    },
    {
      "ID": 3,
      "Patient Name": "Chittema, Theresa M.",
      "Date of Birth": "6/24/1948",
      "Date of Service": "11/18/2019",
      "Facility": "Chamberlain Healthcare Manor",
      "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to chronic obstructive pulmonary disease with (acute) exacerbation and acute and chronic respiratory failure with hypoxia.",
      "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
      "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, respiratory decline. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
      "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
      "Past Medical History": "COPD exacerbation, acute respiratory failure, HTN, hypothyroidism, pre-DM, hypoxemia, and dyspnea",
      "Medications": "As per MAR (reviewed pertinent medications today)",
      "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient is wearing oxygen. He is barrel-chested. He is kyphotic. He has clubbing of the fingernails. Has muscle atrophy of U/LE. Sensation is intact. Has decreased proprioception in the LE. 3/5 strength of LE and 3/5 strength of UE. Has abnormal gait during ambulation.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
      "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. J44.1 Chronic obstructive pulmonary disease with (acute) exacerbation\n5. J96.21 Acute and chronic respiratory failure with hypoxia",
      "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, respiratory decline. Continue working on endurance activities, gait pattern and seated therapy exercises.\n2. Current level of function: BLE ther ex seated without weight 2 x 10 to improve strength and activity tolerance for functional mobility; Cl(S) transfers , req (A) with O2 tubing mgmt\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
    }
  ];

  res.write(JSON.stringify(patient_list), 'utf8');
  //res.write('[{ "ID": 3,"Patient Name": "Chittema, Theresa M.","Date of Birth": "6/24/1948","Date of Service": "11/18/2019","Facility": "Chamberlain Healthcare Manor"}]', 'utf8');

  res.end();
  return;
}
