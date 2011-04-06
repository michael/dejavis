var fs = require('fs');
var assert = require('assert');
var Data = require('data');
var crypto = require('crypto');
var _ = require('underscore');

var config = JSON.parse(fs.readFileSync(__dirname+ '/../config.json', 'utf-8'));

// Setup Data.Adapter
Data.setAdapter('couch', { url: config.couchdb_url });

var encryptPassword = function (password) {
  var hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

// Our Domain Model with some sample data
var seedGraph = {
  
  // Application Configuration Type
  // --------------------
  
  "/type/config": {
    "_id": "/type/config",
    "type": "/type/type",
    "name": "Configuration",
    "properties": {
      "allow_user_registration": {
        "name": "Allow User registration",
        "type": "boolean",
        "unique": true,
        "default": true
      },
    }
  },
  
  // Dejavis Configuration
  // --------------------
  
  "/config/substance": {
    "type": "/type/config",
    "allow_user_registration": true
  },
  
  // User
  // --------------------
  
  "/type/user": {
    "_id": "/type/user",
    "type": "/type/type",
    "name": "User",
    "properties": {
      "username": {
        "name": "Username",
        "unique": true,
        "type": "string",
        "required": true,
        "validator": "^[a-zA-Z_]{1}[a-zA-Z_0-9-]{2,20}$"
      },
      "email": {
        "name": "Email",
        "unique": true,
        "type": "string",
        "required": true,
        "validator": "^(([^<>()[\\]\\\\.,;:\\s@\\\"]+(\\.[^<>()[\\]\\\\.,;:\\s@\\\"]+)*)|(\\\".+\\\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"
      },
      "name": {
        "name": "Full Name",
        "unique": true,
        "type": "string",
        "required": true
      },
      "website": {
        "name": "Website",
        "unique": true,
        "type": "string"
      },
      "company": {
        "name": "Company",
        "unique": true,
        "type": "string"
      },
      "location": {
        "name": "Location",
        "unique": true,
        "type": "string"
      },
      "password": {
        "name": "Password",
        "unique": true,
        "type": "string",
        "required": true,
        "validator": "^\\w{4,}$"
      },
      "created_at": {
        "name": "Created at",
        "unique": true,
        "type": "date"
        // "required": true
      }
    }
  },
  
  // Dataset
  // --------------------
  
  "/type/dataset": {
    "_id": "/type/dataset",
    "type": "/type/type",
    "name": "Dataset",
    "properties": {
      "name": {
        "name": "Name",
        "unique": true,
        "type": "string",
        "default": ""
      },
      "source": {
        "name": "Source URL",
        "unique": true,
        "type": "string",
        "default": ""
      },
      "created_at": {
        "name": "Created at",
        "unique": true,
        "type": "date"
      }
    }
  },
  
  // Project
  // --------------------
  
  "/type/project": {
    "_id": "/type/project",
    "type": "/type/type",
    "name": "Document",
    "properties": {
      "name": {
        "name": "Internal name",
        "unique": true,
        "type": "string",
        "required": true,
        "validator": "^[a-zA-Z_0-9]{1}[a-zA-Z_0-9-]{2,40}$"
      },
      "sheets": {
        "name": "Sheets",
        "unique": false,
        "type": "/type/sheet"
      },
      "title": {
        "name": "Project Title",
        "unique": true,
        "type": "string",
        "default": ""
      },
      "descr": {
        "name": "Description",
        "unique": true,
        "type": "string",
        "default": ""
      },
      "creator": {
        "name": "Creator",
        "unique": true,
        "type": "/type/user",
        "required": true,
        "meta": {
        }
      },
      "created_at": {
        "name": "Created at",
        "unique": true,
        "type": "date",
        "required": true
      },
      "updated_at": {
        "name": "Last modified",
        "unique": true,
        "type": "date",
        "required": true
      },
      "published_on": {
        "name": "Publication Date",
        "unique": true,
        "type": "date"
      }
    }
  },
  
  // Sheet
  // --------------------
  
  "/type/sheet": {
    "_id": "/type/sheet",
    "type": "/type/type",
    "name": "Sheet",
    "properties": {
      "name": {
        "name": "Name",
        "unique": true,
        "type": "string",
        "default": ""
      },
      "project": {
        "name": "Project Membership",
        "unique": true,
        "required": true,
        "type": ["/type/project"]
      },
      "dataset": {
        "name": "Data Set",
        "unique": true,
        "required": true,
        "type": ["/type/dataset"]
      }
    }
  },
    
  // Example User
  // --------------------
  
  "/user/demo": {
    "type": "/type/user",
    "username": "demo",
    "name": "Demo User",
    "email": "demo@dejavis.org",
    "password": encryptPassword('demo'),
    "firstname": "Demo",
    "lastname": "User",
    "created_at": new Date()
  },
  
  // Example Dataset
  // --------------------
  
  "/dataset/hardware_report": {
    "type": "/type/dataset",
    "name": "Hardware Report",
    "source": "http://quasipartikel.at/dejavis/fixtures/hardware_report.json",
    "created_at": new Date()
  },
  
  // Example Project
  // --------------------
  
  "/project/hardware_report": {
    "type": "/type/project",
    "name": "hardware_report",
    "title": "Hardware Report",
    "descr": "Detailed report on hardware in the field",
    "sheets": ["/sheet/sheet1"],
    "creator": "/user/demo",
    "created_at": new Date(),
    "updated_at": new Date(),
    "published_on": new Date()
  },
  
  // Example Sheet
  // --------------------
  
  "/sheet/sheet1": {
    "type": "/type/sheet",
    "name": "comparison",
    "project": "/project/hardware_report",
    "dataset": "/dataset/hardware_report"
  }
};


var graph = new Data.Graph(seedGraph, true);

if (process.argv[2] == "--flush") {
  Data.adapter.flush(function(err) {
    console.log('DB Flushed.');
    err ? console.log(err)
        : graph.sync(function(err, invalidNodes) {
          console.log('invalidNodes:');
          if (invalidNodes) console.log(invalidNodes.keys());
          
          err ? console.log(err)
              : console.log('Couch seeded successfully.\nStart the server: $ node server.js');
        });
  });
} else {
  graph.sync(function(err, invalidNodes) {
    console.log('invalidNodes:');
    if (invalidNodes) console.log(invalidNodes.keys());
    err ? console.log(err)
        : console.log('Couch seeded successfully.\nStart the server: $ node server.js');
  });
}
