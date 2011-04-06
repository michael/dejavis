// Helpers
// --------------

_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};


// Application
// --------------

var Application = Backbone.View.extend({
  events: {
    'submit #login-form': 'login',
    'click a.load-project': 'loadProject',
  },
  
  initialize: function() {
    var that = this;
    
    // this.sheet = new Sheet({model: this.model, collection: this.model, el: '#sheet'});
    
    // Initialize Project Browser
    this.browser = new Browser({app: this });
    
    // Initialize project
    // this.document = new Document({el: '#document_wrapper', app: this});
    this.project = new Project({app: this});
    
    console.log('====');
    
    console.log(this.project.el);
    
    this.header = new Header({el: '#header', app: this});
    
    // Cookie-based auto-authentication
    if (session.username) {
      graph.merge(session.seed);
      this.authenticated = true;
      this.username = session.username;
      this.trigger('authenticated');
      $('#tabs').show();
      // $('.new-document').show();
    } else {
      this.authenticated = false;
    }
    
    this.bind('authenticated', function() {
      that.authenticated = true;
      
      // Re-render browser
      $('#tabs').show();
      // $('.new-document').show();
      that.render();
      
      // that.project.close();
      // that.browser.load(that.query());
      
      // that.browser.bind('loaded', function() {
      //   that.toggleView('browser');
      // });
      
      // controller.saveLocation('#'+that.username);
    });
    
    that.render();
  },
  
  loadProject: function(e) {    
    var user = $(e.currentTarget).attr('user');
        name = $(e.currentTarget).attr('name');
    
    app.project.load(user, name);
    if (controller) {
      controller.saveLocation($(e.currentTarget).attr('href'));
      $('#project_wrapper').attr('url', $(e.currentTarget).attr('href'));
    }
    return false;
  },
  
  login: function() {
    this.authenticate();
    return false;
  },
  
  logout: function() {
    var that = this;
    
    $.ajax({
      type: "POST",
      url: "/logout",
      dataType: "json",
      success: function(res) {
        that.username = null;
        that.authenticated = false;
        that.document.closeDocument();
        that.browser.loaded = false;
        that.browser.render();
        that.render();
        $('#document_tab').hide();
        
        app.toggleStartpage();
        
        controller.saveLocation('');
        $('.new-document').hide();
      }
    });
    return false;
  },
  
  switchTab: function(e) {
    this.toggleView($(e.currentTarget).attr('view'));
  },
  
  toggleView: function(view) {
    $('.tab').removeClass('active');
    $('#'+view+'_tab').addClass('active');
    if (view === 'browser' && !this.browser.loaded) return;
    $('.view').hide();
    $('#'+view+'_wrapper').show();
    
    // Wait until url update got injected
    setTimeout(function() {
      controller.saveLocation($('#'+view+'_wrapper').attr('url'));
    }, 200);
    return false;
  },
  
  toggleStartpage: function() {
    // app.browser.browserTab.render();
    $('#content_wrapper').html(_.tpl('startpage'));
    app.toggleView('content');
    return false;
  },
  
  load: function(url, callback) {
    $.ajax({
      type: "GET",
      url: "/fetch",
      // data: {
      //   qry: JSON.stringify(qry),
      //   options: JSON.stringify(options)
      // },
      dataType: "json",
      success: function(collection) {
        console.log(collection);
        callback(null, collection);
      },
      error: function(err) {
       callback(err);
      }
    });
  },
  
  authenticate: function() {
    var that = this;
    
    $.ajax({
      type: "POST",
      url: "/login",
      data: {
        username: $('#login-user').val(),
        password: $('#login-password').val()
      },
      dataType: "json",
      success: function(res) {
        if (res.status === 'error') {
          return notifier.notify(Notifications.AUTHENTICATION_FAILED);
        } else {
          graph.merge(res.seed);
          that.username = res.username;
          that.trigger('authenticated');
        }
      },
      error: function(err) {
        notifier.notify(Notifications.AUTHENTICATION_FAILED);
      }
    });
    return false;
  },

  render: function() {
    // Should be rendered just once
    var that = this;
    // this.document.render();
    this.browser.render();
    this.header.render();
    // this.sheet.render();
    return this;
  }
});


// Data.setAdapter('AjaxAdapter');

var remote,                              // Remote handle for server-side methods
    app,                                 // The Application
    controller,                          // Controller responding to routes
    editor,                              // A global instance of the Proper Richtext editor
    graph = new Data.Graph(seed, false); // The database

(function() {
  $(function() {
    function browserSupported() {
      if (head.browser.mozilla && head.browser.version > "1.9.2") {
        return true;
      }
      if (head.browser.webkit && head.browser.version > "533.0") {
        return true;
      }
      return false;
    }
    
    // No idea why we have to wait here
    setTimeout(function() {
      $('#container').show();
    }, 1);
    
    if (!browserSupported()) {
      $('#container').html(_.tpl('browser_not_supported'));
      $('#container').show();
      return;
    }
    
    // Init Application
    // --------------

    var items = new Data.Collection(items_fixture);
    app = new Application({el: '#container', model: items, session: session});
    app.render();
        
    // Initialize controller
    controller = new ApplicationController({app: this});
    
    // Start responding to routes
    Backbone.history.start();
    
    // Prevent exit when there are unsaved changes
    window.onbeforeunload = confirmExit;
    
    function confirmExit() {
      if (graph.dirtyNodes().length>0) return "You have unsynced changes, which will be lost. Are you sure you want to leave this page?";
    }
    
    var pendingSync = false;
    graph.bind('dirty', function() {
      // Reload document browser      
      if (!pendingSync) {
        pendingSync = true;
        setTimeout(function() {
          $('#sync_state').html('Synchronizing...');
          graph.sync(function(err, invalidNodes) {
            pendingSync = false;
            if (!err && invalidNodes.length === 0) {
              $('#sync_state').html('Successfully synced.');
              setTimeout(function() {
                $('#sync_state').html('');
              }, 3000);
            } else {
              confirm('There was an error during synchronization. The workspace will be reset for your own safety');
              window.location.reload(true);
            }
          });
        }, 3000);
      }
    });
    
    graph.bind('conflicted', function() {
      if (!app.document.model) return;
      graph.fetch({
        creator: app.document.model.get('creator')._id,
        name: app.document.model.get('name')
      }, {expand: true}, function(err) {
        app.document.render();
        app.scrollTo('#document_wrapper');
      });
      notifier.notify({
        message: 'There are conflicting nodes. The Document will be reset for your own safety.',
        type: 'error'
      });
    });
  });
})();