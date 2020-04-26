//var express = require('express');
var mysql = require('mysql');
var fs = require('fs');
var bodyParser = require('body-parser');
//var pdf = require('html-pdf');
//var pdf = require('node-phantom');
//var app = express();
//LOGGER
//var log4js = require('log4js');
//log4js.configure('./config/log4js.json');
//var log = log4js.getLogger("server");
var pool = mysql.createPool({
	connectionLimit: 100, //important
	host: 'localhost'
	, user: 'root'
	, password: 'admin123'
	, database: 'labs'
	, debug: false
});
//app.use(express.static('public'));

exports.search_all = function (req, res) {
	pool.getConnection(function (err, connection) {
		if (err) {
			res.json({
				"code": 100
				, "status": "Error in connection database"
			});
			return;
		}
		console.log('connected as id ' + connection.threadId);

		connection.query("SELECT s.id_patient ID, concat(p.last_name, ', ', p.first_name) 'Patient Name', DATE_FORMAT(p.birth_date, \"%Y-%m-%d\") 'Date of Birth', DATE_FORMAT(service_date, \"%Y-%m-%d\") 'Date of Service', f.name Facility, chief_complaint 'Chief Complaint', HPI, interval_history 'Interval History', review_of_systems 'Review Of System', medical_history 'Past Medical History', medication 'Medications', physical_examination 'Physical Examination', assessment 'Assessment', plan Plan FROM etreat.service as s ,etreat.Patient as p , etreat.facility as f where s.id_patient = p.id_patient and s.id_facility = f.id", function (err, rows) {

		//connection.query("SELECT s.id_patient, concat(p.last_name, ', ', p.first_name), DATE_FORMAT(p.birth_date, \"%Y-%m-%d\") birth_date, DATE_FORMAT(service_date, \"%Y-%m-%d\") service_date, f.name, chief_complaint, HPI, interval_history, review_of_systems, medical_history, medication, physical_examination, assessment, plan FROM etreat.service as s ,etreat.Patient as p , etreat.facility as f where s.id_patient = p.id_patient and s.id_facility = f.id", function (err, rows) {
			//"select id_patient, first_name, middle_name, last_name, address, city, state, state_name, zip, phone, DATE_FORMAT(birth_date, \"%Y-%m-%d\") birth_date, sex, relation_to_insured, bill_to, insurance_company, insurance_id, insurance_name, DATE_FORMAT(create_time, \"%m/%d/%Y %h:%i:%s\") create_time,DATE_FORMAT(update_time, \"%m/%d/%Y %h:%i:%s\") update_time from labs.patient", function (err, rows) {
			connection.release();
			if (!err) {
				console.log("res = " + JSON.stringify(rows));
				res.json(rows);
			}
		});
		connection.on('error', function (err) {
			res.json({
				"code": 100
				, "status": "Error in connection database"
			});
			return;
		});
	});
}





// SELECT s.id_patient,
// 	concat(p.last_name, ', ', p.first_name),
//     DATE_FORMAT(p.birth_date, \"%Y-%m-%d\") birth_date,
//     DATE_FORMAT(service_date, \"%Y-%m-%d\") service_date,
//     f.name,
//     chief_complaint,
//     HPI,
//     interval_history,
//     review_of_systems,
//     medical_history,
//     medication,
//     physical_examination,
//     assessment,
//     plan
// FROM etreat.service as s
//         ,etreat.Patient as p
//     , etreat.facility as f
// where s.id_patient = p.id_patient
// and s.id_facility = f.id
//
// SELECT s.id_patient ID,
//         concat(p.last_name, ', ', p.first_name) 'Patient Name',
//     DATE_FORMAT(p.birth_date, \"%Y-%m-%d\") 'Date of Birth',
//     DATE_FORMAT(service_date, \"%Y-%m-%d\") 'Date of Service,
//     f.name Facility,
//     chief_complaint 'Chief Complaint',
//     HPI,
//     interval_history 'Interval History',
//     review_of_systems 'Review Of System',
//     medical_history 'Past Medical History',
//     medication 'Medications',
//     physical_examination 'Physical Examination',
//     assessment 'Assessment',
//     plan Plan
// FROM etreat.service as s
//         ,etreat.Patient as p
//     , etreat.facility as f
// where s.id_patient = p.id_patient
// and s.id_facility = f.id
