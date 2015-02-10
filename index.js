// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in Ripple or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.
(function () {
    "use strict";
    document.addEventListener('deviceready', onDeviceReady.bind(this), false);

    function onDeviceReady() {
        var pushNotification;
        pushNotification = window.plugins.pushNotification;
                if ('android' === device.platform.toLowerCase()) {
                    pushNotification.register(
                        successHandler,
                        errorHandler, {
                            senderID: "493774121211",
                            ecb: "onNotificationGCM"
                        });
                }
                else {
                    pushNotification.register(
                        tokenHandler,
                        errorHandler, {
                            "badge": "true",
                            "sound": "true",
                            "alert": "true",
                            "ecb": "onNotificationAPN"
                        });
                }
    };

   
 

    function onPause() {
        // TODO: This application has been suspended. Save application state here.
    };

    function onResume() {
        // TODO: This application has been reactivated. Restore application state here.
    };

})();
	function onNotificationAPN(event) {
		if (event.alert) {
			navigator.notification.alert(event.alert);
		}

		if (event.sound) {
			var snd = new Media(event.sound);
			snd.play();
		}

		if (event.badge) {
			pushNotification.setApplicationIconBadgeNumber(successHandler, errorHandler, event.badge);
		}
	}

	// Android
	function onNotificationGCM(deviceEvent) {
		alert(deviceEvent.regid);
		$("#app-status-ul").append('<li>EVENT -> RECEIVED:' + deviceEvent.event + '</li>');
		switch (deviceEvent.event) {
			case 'registered':
				if (deviceEvent.regid.length > 0) {
					$("#app-status-ul").append('<li>REGISTERED -> REGID:' + deviceEvent.regid + "</li>");
					// Your GCM push server needs to know the regID before it can push to this device
					// here is where you might want to send it the regID for later use.
					$('#deviceId').text(deviceEvent.regid);
					console.log("regID = " + deviceEvent.regid);
					 $.ajax({
						url: "http://10.115.50.71/IRMobile/Content/RegisterDevice?deviceId=" + deviceEvent.regid,
					}).done(function () {
						console.log("regID = " + deviceEvent.regid);
					}).fail(function () {
						alert("error");
					});
				}
				break;

			case 'message':
				// if this flag is set, this notification happened while we were in the foreground.
				// you might want to play a sound to get the user's attention, throw up a dialog, etc.
				if (deviceEvent.foreground) {
					$("#app-status-ul").append('<li>--INLINE NOTIFICATION--' + '</li>');

					// if the notification contains a soundname, play it.
					var my_media = new Media("/android_asset/www/" + deviceEvent.soundname);
					my_media.play();
				}
				else {  // otherwise we were launched because the user touched a notification in the notification tray.
					if (deviceEvent.coldstart) {
						$("#app-status-ul").append('<li>--COLDSTART NOTIFICATION--' + '</li>');
					}
					else {
						$("#app-status-ul").append('<li>--BACKGROUND NOTIFICATION--' + '</li>');
					}
				}

				$("#app-status-ul").append('<li>MESSAGE -> MSG: ' + deviceEvent.payload.message + '</li>');
				$("#app-status-ul").append('<li>MESSAGE -> MSGCNT: ' + deviceEvent.payload.msgcnt + '</li>');
				break;

			case 'error':
				alert('<li>ERROR -> MSG:' + deviceEvent.msg + '</li>');
				break;

			default:
				alert('<li>EVENT -> Unknown, an event was received and we do not know what it is</li>');
				break;
		}
	}

	function errorHandler(error) {
		alert('error = ' + error);
	}
	function tokenHandler(result) {
		// Your iOS push server needs to know the token before it can push to this device
		// here is where you might want to send it the token for later use.
		console.log("Device token" + result);
	}

	function successHandler(result) {
		alert(result);
		console.log('result = ' + result);
	}

