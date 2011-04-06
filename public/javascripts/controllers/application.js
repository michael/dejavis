var ApplicationController = Backbone.Controller.extend({
  routes: {
    '^(?!search)(.*)\/(.*)$': 'loadProject',
    '^(?!search)(.*)\/(.*)\/(.*)$': 'loadProject',
    ':username': 'userProjects',
    '^search\/(.*)$': 'searchProjects'
  },
  
  loadProject: function(username, projectname, node) {
    
    app.browser.load({"type": "user", "value": username});
    app.project.load(username, projectname);

    $('#project_wrapper').attr('url', '#'+username+'/'+projectname);
    $('#browser_wrapper').attr('url', '#'+username);
    return false;
  },
  
  userProjects: function(username) {
    if (!username) { // startpage rendering
      if (app.username) {
        username = app.username;
      } else {
        return app.toggleStartpage();
      }
    }
    
    if (username === 'recent') {
      app.browser.load({"type": "recent", "value": 50});
    } else {
      app.browser.load({"type": "user", "value": username});
    }
    
    $('#browser_wrapper').attr('url', '#'+username);
    
    app.browser.bind('loaded', function() {
      app.toggleView('browser');
      app.browser.unbind('loaded');
    });
    return false;
  },
  
  searchProjects: function(searchstr) {
    // app.searchDocs(searchstr);
    // return false;
  }
});