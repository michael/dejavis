var Signup = Backbone.View.extend({
  events: {
    'submit #signup-form': 'registerUser'
  },
  
  initialize: function(options) {
    
  },
  
  registerUser: function() {
    var that = this;
    
    $('.page-content .input-message').empty();
    $('#registration_error_message').empty();
    $('.page-content input').removeClass('error');
    
    $.ajax({
      type: "POST",
      url: "/register",
      data: {
        username: $('#signup_user').val(),
        name: $('#signup_name').val(),
        email: $('#signup_email').val(),
        password: $('#signup_password').val()
      },
      dataType: "json",
      success: function(res) {
        if (res.status === 'error') {
          if (res.field === "username") {
            $('#signup_user').addClass('error');
            $('#signup_user_message').html(res.message);
          } else {
            $('#registration_error_message').html(res.message);
          }
        } else {
          graph.merge(res.seed);
          notifier.notify(Notifications.AUTHENTICATED);
          app.username = res.username;          
          app.trigger('authenticated');
          
          app.project.close();
          app.browser.load(app.query());

          app.browser.bind('loaded', function() {
            app.toggleView('browser');
          });

          controller.saveLocation('#'+app.username);
        }
      },
      error: function(err) {
        $('#registration_error_message').html('Unknown error.');
      }
    });
    
    return false;
  },
  
  render: function() {
    $(this.el).html(_.tpl('signup', {}));
  }
});