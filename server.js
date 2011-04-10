var express = require('express');
var app = express.createServer();
var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var async = require('async');
var Data = require('data');
var _ = require('underscore');
var CouchClient = require('./lib/couch-client');

// Helpers
// -----------

function encryptPassword(password) {
  var hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

function fetchResource(url, accessToken, clientIP, callback) {
  fragments = require('url').parse(url);
  options = { host: fragments.host, path: fragments.pathname };
  if (fragments.search) {
    options.path += fragments.search;
    if (accessToken && clientIP) options.path += "&access_token="+accessToken+"&client_ip="+clientIP;
  } else if (accessToken) {
    options.path += "?access_token="+accessToken+"&client_ip="+clientIP;
  }
  
  console.log('Requesting datasource...');
  console.log(options);
  
  // TODO: rather stream through
  http.get(options, function(cres) {
    if (cres.statusCode !== 200) return callback('error', '');
    
    cres.setEncoding('utf8');
    json = "";
    cres.on('data', function(d) {
      json += d;
    });
    
    cres.on('end', function() {
      callback(null, json);
    });
    
  }).on('error', function(e) {
    callback(e);
  });
}

// App Config
global.config = JSON.parse(fs.readFileSync(__dirname+ '/config.json', 'utf-8'));

// Setup Data.Adapter
Data.setAdapter('couch', { url: config.couchdb_url});

var seed;
var db = CouchClient(config.couchdb_url);
var graph = new Data.Graph();


// Fetch a single node from the graph
function fetchNode(id, callback) {
  db.get(id, function(err, node) {
    if (err) return callback(err);
    callback(null, node);
  });
}

// Get a single project from the database, including all associated sheets
function getProject(username, projectname, callback) {
  db.view(db.uri.pathname+'/_design/dejavis/_view/projects', {key: username+'/'+projectname}, function(err, res) {
    // Bug-workarount related to https://github.com/creationix/couch-client/issues#issue/3
    // Normally we'd just use the err object in an error case
    if (res.error || !res.rows) {
      callback(res.error);
    } else {
      var result = {};
      var count = 0;
      
      if (res.rows.length >0) {
        var doc = res.rows[0].value;
        result[doc._id] = doc;
        // Fetches associated objects
        function fetchAssociated(node, callback) {
          // Fetch sheets
          if (!node.sheets) return callback(null);
          async.forEach(node.sheets, function(sheet, callback) {
            fetchNode(sheet, function(err, node) {
              if (err) callback(err);
              result[node._id] = node;
              delete result[node._id].datasource;
              callback(null);
            });
          }, function(err) {
            callback(null);
          });
        }

        fetchAssociated(res.rows[0].value, function(err) {
          // Fetch attributes and user
          async.forEach([doc.creator], function(nodeId, callback) {
            fetchNode(nodeId, function(err, node) {
              if (err) { console.log('FATAL: BROKEN REFERENCE!'); console.log(err); return callback(); }
              result[node._id] = node;
              delete result[node._id].password;
              delete result[node._id].datasource_permissions;
              callback(null);
            });
          }, function(err) { 
            callback(err, result, doc._id); 
          });
        });
      } else {
        callback('not found');
      }
    }
  });
}

function getPermission(datasourceId, userId, callback) {
  db.view(db.uri.pathname+'/_design/dejavis/_view/datasource_permissions', {key: datasourceId+':/user/'+userId}, function(err, res) {
    // Bug-workarount related to https://github.com/creationix/couch-client/issues#issue/3
    // Normally we'd just use the err object in an error case
    if (res.error || !res.rows) {
      callback(res.error, false);
    } else {
      res.rows.length > 0 ? callback(null, res.rows[0].value)
                          : callback('permission_denied', false);
    }
  });
}


// Get sheet with datasource (only if privileged)
// And yes, I'm aware its a messy sketch
function fetchData(sheetId, req, callback) {
  var clientIP = req.headers['x-forwarded-for'] ? _.last(req.headers['x-forwarded-for'].split(',')).trim()
                                                : req.connection.remoteAddress;

  fetchNode(sheetId, function(err, sheet) {
    if (err) return callback('permission_denied', '{"status": "error", "message": "permission_denied"}');
    fetchNode(sheet.project, function(err, project) {
      if (err) return callback('permission_denied', '{"status": "error", "message": "permission_denied"}');
      
      if (project.published_on) {
        fetchNode(sheet.datasource, function(err, datasource) {
          fetchResource(datasource.url, "", clientIP, function(err, content) {
            if (!err) {
              callback(null, content);
            } else {
              callback('permission_denied', '{"status": "error", "message": "permission_denied"}');
            }
          });
        });
        
      } else {
        getPermission(sheet.datasource, req.session.username, function(err, permission) {
          if (err) return callback('permission_denied', '{"status": "error", "message": "permission_denied"}');
          fetchNode(sheet.datasource, function(err, datasource) {
            fetchResource(datasource.url, permission.access_token, clientIP, function(err, content) {
              if (!err) {
                callback(null, content);
              } else {
                callback('permission_denied', '{"status": "error", "message": "permission_denied"}');
              }
            });
          });
        });        
      }
    });
  });
}

function findUsers(searchstr, callback) {
  db.view(db.uri.pathname+'/_design/dejavis/_view/users', function(err, res) {
    // Bug-workarount related to https://github.com/creationix/couch-client/issues#issue/3
    // Normally we'd just use the err object in an error case
  
    if (res.error || !res.rows) {
      callback(res.error);
    } else {
      var result = {};
      var count = 0;
      
      _.each(res.rows, function(row) {
        if (row.key && row.key.match(new RegExp("("+searchstr+")", "i"))) {
          // Add to result set
          if (count < 200) { // 200 Users maximum
            count += 1;
            result[row.value._id] = row.value;
            delete result[row.value._id].password
            delete result[row.value._id].email
          }
        }
      });
      callback(null, result);
    }
  });
}

// We are aware that this is not a performant solution.
// But search functionality needed to be there, quickly.
// We'll replace it with a speedy fulltext search asap.
function findProjects(searchstr, type, username, callback) {
  db.view(db.uri.pathname+'/_design/dejavis/_view/projects_by_keyword', function(err, res) {
    // Bug-workarount related to https://github.com/creationix/couch-client/issues#issue/3
    // Normally we'd just use the err object in an error case
  
    if (res.error || !res.rows && _.include(["user", "keyword"], type)) {
      callback(res.error);
    } else {
      var result = {};
      var associatedItems = [];
      var count = 0;
      var matched;
      _.each(res.rows, function(row) {
        if (type === "keyword") {
          matched = row.key && row.key.match(new RegExp("("+searchstr+")", "i"));
        } else {
          matched = row.value.creator.match(new RegExp("/user/("+searchstr+")$", "i"));
        }
        
        if (matched && (row.value.published_on || row.value.creator === '/user/'+username)) {
          // Add to result set
          if (!result[row.value._id]) count += 1;
          if (count < 200) { // 200 Documents maximum
            result[row.value._id] = row.value;
            // Include associated objects like attributes and users
            associatedItems = associatedItems.concat([row.value.creator]);
            if (row.value.subjects) associatedItems = associatedItems.concat(row.value.subjects);
            if (row.value.entities) associatedItems = associatedItems.concat(row.value.entities);
          }
        }
      });
      
      if (type === 'user') {
        associatedItems.push('/user/'+searchstr.toLowerCase());
      }

      // Fetch associated items
      // TODO: make dynamic
      async.forEach(_.uniq(associatedItems), function(nodeId, callback) {
        fetchNode(nodeId, function(err, node) {
          if (err) { console.log('BROKEN REFERENCE!'); console.log(err); return callback(); }
          result[node._id] = node;
          delete result[node._id].password;
          callback();
        });
      }, function(err) { callback(err, result, count); });
    }
  });
}


// Express.js Configuration
// -----------

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({secret: config['secret']}));
  app.use(app.router);
  app.use(express.static(__dirname+"/public", { maxAge: 41 }));
  app.use(express.logger({ format: ':method :url' }));
});


// Routes
// -----------

app.get('/', function(req, res) {
  html = fs.readFileSync(__dirname+ '/templates/app.html', 'utf-8');
  res.send(html.replace('{{{{seed}}}}', JSON.stringify(seed))
               .replace('{{{{session}}}}', JSON.stringify(req.session)));
});

// Return data associated with a sheet, security aware
app.get('/data', function(req, res) {
  fetchData(req.query.sheet, req, function(err, data) {
    res.send(data);
  });
});



// Quick search interface (returns found users and a documentset)
app.get('/search/:search_str', function(req, res) {
  findProjects(req.params.search_str, 'keyword', req.session.username, function(err, graph, count) {
    // res.send(JSON.stringify({project_count: count, users: []}));
    findUsers(req.params.search_str, function(err, users) {
      res.send(JSON.stringify({document_count: count, users: users}));
    });
  });
});

// Find documents by search string (full text search in future)
// Or find by user
app.get('/projects/search/:type/:search_str', function(req, res) {
  if (req.params.type == 'recent') {
    res.send('not yet supported');
    // recentProjects(req.params.search_str, req.session.username, function(err, graph, count) {
    //   res.send(JSON.stringify({graph: graph, count: count}));
    // });
  } else {
    findProjects(req.params.search_str, req.params.type, req.session.username, function(err, graph, count) {
      res.send(JSON.stringify({graph: graph, count: count}));
    });
  }
});

// Returns the most recent version of the requested doc
app.get('/projects/:username/:name', function(req, res) {
  getProject(req.params.username, req.params.name, function(err, graph, id) {
    if (err) return res.send({status: "error", error: err});
    res.send({status: "ok", graph: graph, id: id});
  });
});

app.post('/login', function(req, res) {  
  var username = req.body.username.toLowerCase(),
      password = req.body.password;
  
  var graph = new Data.Graph(seed);
  graph.fetch({type: '/type/user'}, function(err) {
    if (!err) {
      var user = graph.get('/user/'+username);
      if (user && username === user.get('username').toLowerCase() && encryptPassword(password) === user.get('password')) {
        var seed = {};
        seed[user._id] = user.toJSON();
        delete seed[user._id].password;
        res.send({
          status: "ok",
          username: username,
          seed: seed
        });
        
        req.session.username = username;
        req.session.seed = seed;
      } else {
        res.send({status: "error"});
      }
    } else {
      res.send({status: "error"});
    }
  });
});

app.post('/logout', function(req, res) {  
  delete req.session.username;
  delete req.session.seed;
  res.send({status: "ok"});
});

graph.fetch({"type|=": ["/type/type", "/type/config"]}, function(err, nodes) {
  if (err) {
    console.log("ERROR: Couldn't fetch schema");
    console.log(err);
  } else {
    seed = nodes.toJSON();
    
    console.log('READY: Dejavis is listening http://localhost:6006');
    app.listen(6006);
  }
});