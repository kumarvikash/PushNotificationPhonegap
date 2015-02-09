(function ($) {
    var _settings = new Array();
    var methods = {
        hideResults: function () {
            return this.each(function () {
                settings = _settings[this.id];
                var status = 0; //send back a status to the callback function to let the function know if there was an error (0) or if it was successful (1)
                if (typeof (settings) != 'undefined') {
                    settings.resultsContainer.removeClass('tr-instant-search-results-shown').addClass('tr-instant-search-results-hidden');

                    //results are closed, remove the click events
                    $(document).off('click.instantSearch');
                    settings.wrapper.off('click.instantSearch');

                    status = 1; //no problems
                }
                settings.hideResultsCallback(status);
            });
        },
        showResults: function (htmlBlob) {
            return this.each(function () {
                settings = _settings[this.id];
                var status = 0; //send back a status to the callback function to let the function know if there was an error (0) or if it was successful (1)
                if (typeof (settings) != 'undefined') {
                    var $this = this;
                    settings.resultsContainer
                                .html(htmlBlob)
                                //.css({ top: settings.input.outerHeight() })
                                .removeClass('tr-instant-search-results-hidden').addClass('tr-instant-search-results-shown');

                    settings.wrapper.on('click.instantSearch', function (e) {
                        //dont let the document event fire
                        //e.stopPropagation();
                    });
                    /*
                    $(document).on('click.instantSearch', function (e) {
                        $($this).instantSearch('hideResults');
                    });
                    */
                    status = 1; //no problems
                }
                settings.showResultsCallback(status);
            });
        },
        inputHandler: function (e) {
            return this.each(function () {
                settings = _settings[this.id];
                if (typeof (settings) != 'undefined') {
                    if (settings._timer) { clearInterval(settings._timer); }  //stop the current search if it exists
                    var searchString = $.trim(settings.input.val());
                    if (searchString != "") {
                        if (searchString.length >= settings.characterDelay) {
                            settings._timer = setTimeout(function () {
                                settings.keyUpCallback(searchString);
                            }, settings.delay);
                        }
                    }
                    else {
                        $(settings.input).instantSearch('hideResults');
                    }
                }
            });
        },
        init: function (options) {
            // Create some defaults, extending them with any options that were provided
            var settings = $.extend({
                '_timer': null,
                'appendTo': null,
                'characterDelay': 0,
                'delay': 500,
                'hideResults': function () { $(settings.input).instantSearch('hideResults') }, //helper object to call global hideResults method
                'hideResultsCallback': function () { },
                'inputHandler': function () { $(settings.input).instantSearch('inputHandler') }, //helper object to call global inputHandler method
                'keyUpCallback': function (term) { alert('user searched for ' + term); }, //deprecated - use inputCallback
                'prependTo': null,
                'showResults': function (htmlBlob) { $(settings.input).instantSearch('showResults', htmlBlob); }, //helper object to call global showResults method
                'showResultsCallback': function () { },
                'submitOnEnter': false,
                'useOnInput': false, 
                'wrapperClass': ''
            }, options); //end of settings

            return this.each(function () {
                //save the settings to the private object for access later using the element's id as the array index
                if (!this.id) this.id = 'instantSearchControl_' + _settings.length;
                _settings[this.id] = settings;

                var $this = $(this);

                //do some setup
                $this.addClass('tr-instant-search').attr({ 'autocomplete': 'off', 'data-role': 'search' });
                var $wrapper = $this.wrap($('<div class="tr-widget tr-instant-search-wrapper"/>')).closest('.tr-instant-search-wrapper');
                var $container;

                if (settings.appendTo) {
                    $container = $('<div class="tr-instant-search-results" data-role="results"/>')
                            .addClass('tr-instant-search-results-hidden')
                            .addClass(settings.wrapperClass)
                            .appendTo($(settings.appendTo));
                }
                else if (settings.prependTo) {
                    $container = $('<div class="tr-instant-search-results" data-role="results"/>')
                            .addClass('tr-instant-search-results-hidden')
                            .addClass(settings.wrapperClass)
                            .prependTo($(settings.prependTo));
                }
                else { //no specific location for the results passed in so just add the results after the search box
                    $container = $('<div class="tr-instant-search-results" data-role="results"/>')
                        .css({ position: 'absolute' })
                        .addClass('tr-instant-search-results-hidden')
                        .addClass(settings.wrapperClass)
                        .appendTo($wrapper);
                }



                //save some stuff for easy access later
                settings.input = $this;
                settings.wrapper = $wrapper;
                settings.resultsContainer = $container;



                //placeholder polyfill
                test = document.createElement('input');
                if (!('placeholder' in test)) {
                    var placeholder = $this.attr('placeholder');
                    if (placeholder.length) { //trying to use a placeholder but the browser doesnt support it, add the support
                        var active = document.activeElement;
                        $this.focus(function () {
                            if ($(this).attr('placeholder') != '' && $(this).val() == $(this).attr('placeholder')) {
                                $(this).val('').removeClass('hasPlaceholder');
                            }
                        }).blur(function () {
                            if ($(this).attr('placeholder') != '' && ($(this).val() == '' || $(this).val() == $(this).attr('placeholder'))) {
                                $(this).val($(this).attr('placeholder')).addClass('hasPlaceholder');
                            }
                        });
                        $this.blur();
                        //$this.focus();
                        $('form:eq(0)').submit(function () {
                            $(':text.hasPlaceholder').val('');
                        });
                    }
                }

                if (settings.useOnInput) {
                    $this.bind("input", function (e) {
                        settings.inputHandler(e);
                    });
                }
                else { //add keyup
                    $this.keyup(function (e) {
                        settings.inputHandler(e);
                    });
                }

                $this.keydown(function (e) {
                    if (e.which == 13) {
                        if (settings.submitOnEnter)
                            $(e.target).closest('form').submit();
                        e.preventDefault();
                    }
                });

            }); //end of each()
        } //end of init()
    };

    $.fn.instantSearch = function (method) {
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.instant-search');
        }

    };
})(jQuery);