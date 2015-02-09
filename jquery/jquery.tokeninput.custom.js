/*
* jQuery Plugin: Tokenizing Autocomplete Text Entry
* Version 1.6.0
*
* Copyright (c) 2009 James Smith (http://loopj.com)
* Licensed jointly under the GPL and MIT licenses,
* choose which one suits your project best!
*
*/

(function ($) {

    // Default settings
    var DEFAULT_SETTINGS = {
        // Search settings
        method: "GET",
        contentType: "json",
        queryParam: "q",
        searchDelay: 300,
        minChars: 1,
        propertyToSearch: "name",
        jsonContainer: null,
        multiInput: false,
        isMulti: false,

        // Display settings
        hintText: "Type in a search term",
        noResultsText: "No results",
        searchingText: "Searching...",
        errorText: "No Results Found",
        deleteText: "&times;",
        animateDropdown: true,

        // Tokenization settings
        tokenLimit: null,
        tokenDelimiter: ",",
        preventDuplicates: false,

        // Output settings
        tokenValue: "id",

        // Prepopulation settings
        prePopulate: null,
        processPrePopulate: false,

        // Manipulation settings
        idPrefix: "token-input-",

        // Formatters
        resultsFormatter: function (item) { return "<li>" + item[this.propertyToSearch] + "</li>"; },
        tokenFormatter: function (item) { return "<li><p>" + item[this.propertyToSearch] + "</p></li>"; },

        queryGetter: null,
        isNavigating: false,

        // Callbacks
        onResult: null,
        onAdd: null,
        onDelete: null,
        onReady: null,
        onEnter: null, /* JB: Added for custom handling when user hits the Enter Key in the input box */
        onResultClick: null, /* JB: Added for custom handling when user clicks a dropdown result item */
        onAjaxError: null,
        onSuccess: null /* SPG: Added to show log in UI */
    };

    // Default classes to use when theming
    var DEFAULT_CLASSES = {
        tokenList: "token-input-list",
        token: "token-input-token",
        tokenDelete: "token-input-delete-token",
        selectedToken: "token-input-selected-token",
        highlightedToken: "token-input-highlighted-token",
        dropdown: "token-input-dropdown",
        dropdownItem: "token-input-dropdown-item",
        dropdownItem2: "token-input-dropdown-item2",
        selectedDropdownItem: "token-input-selected-dropdown-item",
        inputToken: "token-input-input-token",
        category: "token-input-category"
    };

    // Input box position "enum"
    var POSITION = {
        BEFORE: 0,
        AFTER: 1,
        END: 2
    };
    var HighlightPattern = "(?![^&;]+;)(?!<[^<>]*)({0})(?![^<>]*>)(?![^&;]+;)";
    // Keys "enum"
    var KEY = {
        BACKSPACE: 8,
        TAB: 9,
        ENTER: 13,
        ESCAPE: 27,
        SPACE: 32,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        NUMPAD_ENTER: 108,
        COMMA: 188
    };

    // Additional public (exposed) methods
    var methods = {
        init: function (url_or_data_or_function, options) {
            var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

            return this.each(function () {
                $(this).data("tokenInputObject", new $.TokenList(this, url_or_data_or_function, settings));
            });
        },
        update: function (url_or_data_or_function, options) {///SPG:Added to update the field and options
            var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

            return this.each(function () {
                $(this).data("tokenInputObject", new $.TokenList(this, url_or_data_or_function, settings));
            });
        },
        clear: function () {
            this.data("tokenInputObject").clear();
            return this;
        },
        add: function (item) {
            this.data("tokenInputObject").add(item);
            return this;
        },
        remove: function (item) {
            this.data("tokenInputObject").remove(item);
            return this;
        },
        get: function () {
            return this.data("tokenInputObject").getTokens();
        },
        //JB: Added for the ability to access additional data like current input string and currently highlighted ddl item in additoon to the tokens that the above "get" method provides
        getAllData: function () {
            return this.data("tokenInputObject").getAllData();
        },
        //JB: Added for the ability to change the ajax url after init
        updateDataSource: function (url_or_data_or_function) {
            return this.data("tokenInputObject").updateDataSource(url_or_data_or_function);
        },
        //SPG: Added for the ability to change the hint text after init
        updateHintText: function (hint_text) {
            return this.data("tokenInputObject").updateHintText(hint_text);
        }
    }

    // Expose the .tokenInput function to jQuery as a plugin
    $.fn.tokenInput = function (method) {
        // Method calling and initialization logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else {
            return methods.init.apply(this, arguments);
        }
    };

    // TokenList class for each input
    $.TokenList = function (input, url_or_data, settings) {
        //
        // Initialization
        //

        // Configure the data source
        configureDataSource(url_or_data);

        // Build class names
        if (settings.classes) {
            // Use custom class names
            settings.classes = $.extend({}, DEFAULT_CLASSES, settings.classes);
        } else if (settings.theme) {
            // Use theme-suffixed default class names
            settings.classes = {};
            $.each(DEFAULT_CLASSES, function (key, value) {
                settings.classes[key] = value + "-" + settings.theme;
            });
        } else {
            settings.classes = DEFAULT_CLASSES;
        }


        // Save the tokens
        var saved_tokens = [];

        // Keep track of the number of tokens in the list
        var token_count = 0;

        // Basic cache to save on db hits
        var cache = new $.TokenList.Cache();

        // Keep track of the timeout, old vals
        var timeout;
        var input_val;

        // Create a new text input an attach keyup events
        var input_box = $("<input type=\"text\"  autocomplete=\"off\">")
        .css({
            outline: "none"
        })
        .val(input.value)
        .attr("id", settings.idPrefix + input.id)
        .focus(function () {
            if (settings.tokenLimit === null || settings.tokenLimit !== token_count) {
                show_dropdown_hint();

            }

        })
        .blur(function () {
            /* ####################################################################################################
            JB: Commenting this out to make debugging easier*/
            hide_dropdown();
            /*#####################################################################################################*/
            /* ####################################################################################################
            JB: Don't want to clear out this value because we want users to be able to search partial terms
            $(this).val("");
            /*#####################################################################################################*/
        })
        .bind("keyup keydown blur update", resize_input)
        .keydown(function (event) {
            var previous_token;
            var next_token;

            switch (event.keyCode) {
                //case KEY.LEFT:                                                 
                //case KEY.RIGHT:                                                 
                case KEY.UP:
                case KEY.DOWN:
                    if (!$(this).val()) {
                        previous_token = input_token.prev();
                        next_token = input_token.next();

                        if ((previous_token.length && previous_token.get(0) === selected_token) || (next_token.length && next_token.get(0) === selected_token)) {
                            // Check if there is a previous/next token and it is selected
                            if (event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) {
                                deselect_token($(selected_token), POSITION.BEFORE);
                            } else {
                                deselect_token($(selected_token), POSITION.AFTER);
                            }
                        } else if ((event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) && previous_token.length) {
                            // We are moving left, select the previous token if it exists
                            select_token($(previous_token.get(0)));
                        } else if ((event.keyCode === KEY.RIGHT || event.keyCode === KEY.DOWN) && next_token.length) {
                            // We are moving right, select the next token if it exists
                            select_token($(next_token.get(0)));
                        }
                    } else {
                        var dropdown_item = null;

                        if (event.keyCode === KEY.DOWN || event.keyCode === KEY.RIGHT) {
                            //JB: I removed the default selected item in populate_dropdown(), and therefore need to null check here
                            //dropdown_item = $(selected_dropdown_item).next();
                            dropdown_item = (selected_dropdown_item) ? $(selected_dropdown_item).next() : dropdown.find('li:first');
                        } else {
                            //JB: on KEY.UP || KEY.LEFT, I want to de-select if it was the 1st item
                            //dropdown_item = $(selected_dropdown_item).prev();
                            if ($(selected_dropdown_item).is(dropdown.find('li:first'))) {
                                deselect_dropdown_item($(selected_dropdown_item));
                            }
                            else {
                                dropdown_item = $(selected_dropdown_item).prev();
                            }
                        }

                        if (dropdown_item && dropdown_item.length) {
                            select_dropdown_item(dropdown_item);
                        }

                        return false;
                    }
                    break;

                case KEY.BACKSPACE:
                    previous_token = input_token.prev();

                    if (!$(this).val().length) {
                        if (selected_token) {
                            delete_token($(selected_token));
                            hidden_input.change();
                        } else if (previous_token.length) {
                            select_token($(previous_token.get(0)));
                        }

                        return false;
                    } else if (($(this).val().length === 1) || ($(this).val().length <= 1)) {
                        hide_dropdown();
                    } else {
                        // set a timeout just long enough to let this function finish.
                        setTimeout(function () { do_search(); }, 5);
                    }
                    break;

                /*####################################################################################################################
                JB: Customizing the Enter key to go directly to the record
                case KEY.TAB:
                case KEY.ENTER:
                case KEY.NUMPAD_ENTER:
                case KEY.COMMA:
                if(selected_dropdown_item) {
                add_token($(selected_dropdown_item).data("tokeninput"));
                hidden_input.change();
                return false;
                }
                break;
                */ 
                case KEY.TAB:
                case KEY.NUMPAD_ENTER:
                    //case KEY.COMMA:	//JB: Removing commas so users can enter them
                    var tabOut = true;

                    if (selected_dropdown_item && settings.isMulti) {
                        tabOut = false;
                        add_token($(selected_dropdown_item).data("tokeninput"));
                    }

                    hidden_input.change();
                    return tabOut;

                case KEY.ENTER:
                    /*//alert('This action would take the user directly to the selected record.');
                    if (selected_dropdown_item && lsRecordClicked)
                    lsRecordClicked($(selected_dropdown_item).data("tokeninput"))
                    return false;
                    break;*/

                    //JB: If the user has already started building a token list, we always want to add to it.  Otherwise, Enter should select the record 
                    if (selected_dropdown_item) {
                        if (token_count > 0) {
                            add_token($(selected_dropdown_item).data("tokeninput"));
                            hidden_input.change();
                            return false;
                        }
                        //						else {
                        //							//alert('This action would take the user directly to the selected record.');
                        //							if (selected_dropdown_item && lsRecordClicked)
                        //								lsRecordClicked($(selected_dropdown_item).data("tokeninput"))
                        //							return false;
                        //						}
                        //					}
                        //					//if no dropdown item selected, but there is a search term, then submit search
                        //					else if (input_box.val().length > 0) {
                        //						alert('This action would submit the search');
                        //						return false;
                    }

                    // Execute the onEnter callback if defined
                    var callback = settings.onEnter;
                    if ($.isFunction(callback)) {
                        //Set this to true so that suggestion dropdown is not showed.
                        settings.isNavigating = true;

                        //Call the supplied callback passing the orig input control back as the "this" param to facilitate further access to the tokenInput control if needed
                        callback.call(hidden_input, hidden_input.data("tokenInputObject").getAllData());
                    }

                    break;

                /*####################################################################################################################*/ 
                case KEY.ESCAPE:
                    hide_dropdown();
                    return true;

                default:
                    if (String.fromCharCode(event.which)) {
                        // set a timeout just long enough to let this function finish.
                        setTimeout(function () { do_search(); }, 5);
                    }
                    break;
            }
        });

        // Keep a reference to the original input box
        //input_box.val($(input).val()); 				//JB: preserving any default value before clearning.
        var hidden_input = $(input)
                           .hide()
                           .val("")
                           .focus(function () {
                               input_box.focus();
                           })
                           .blur(function () {
                               input_box.blur();
                           });

        // Keep a reference to the selected token and dropdown item
        var selected_token = null;
        var selected_token_index = 0;
        var selected_dropdown_item = null;

        // The list to store the token items in
        var token_list = $("<ul />")
        .addClass(settings.classes.tokenList)
        .css('width', hidden_input.css('width'))	//JB: this is to set the width based on orig input width
        .click(function (event) {

            var li = $(event.target).closest("li");
            if (li && li.get(0) && $.data(li.get(0), "tokeninput")) {
                toggle_select_token(li);
            } else {
                // Deselect selected token
                if (selected_token) {
                    deselect_token($(selected_token), POSITION.END);
                }

                // Focus input box
                input_box.focus();

                //updated by sreejith for removing caret position for textboxes

                //		        setCaretPosition(input_box.attr("id"), input_box.val().length)
                //		        var input_text = input_box.val();
                //		        input_box.val(input_text);

            }
        })
        .mouseover(function (event) {
            var li = $(event.target).closest("li");
            if (li && selected_token !== this) {
                li.addClass(settings.classes.highlightedToken);
            }
        })
        .mouseout(function (event) {
            var li = $(event.target).closest("li");
            if (li && selected_token !== this) {
                li.removeClass(settings.classes.highlightedToken);
            }
        })
        .insertBefore(hidden_input);

        // The token holding the input box
        var input_token = $("<li />")
        .addClass(settings.classes.inputToken)
        .appendTo(token_list)
        .append(input_box);

        // The list to store the dropdown items in
        var dropdown = $("<div>")
        .addClass(settings.classes.dropdown)
        .appendTo("body")
        .hide();

        // Magic element to help us resize the text input
        var input_resizer = $("<tester/>")
        .insertAfter(input_box)
        .css({
            position: "absolute",
            top: -9999,
            left: -9999,
            width: "auto",
            fontSize: input_box.css("fontSize"),
            fontFamily: input_box.css("fontFamily"),
            fontWeight: input_box.css("fontWeight"),
            letterSpacing: input_box.css("letterSpacing"),
            whiteSpace: "nowrap"
        });

        // Pre-populate list if items exist
        hidden_input.val("");
        var li_data = settings.prePopulate || hidden_input.data("pre");
        if (settings.processPrePopulate && $.isFunction(settings.onResult)) {
            li_data = settings.onResult.call(hidden_input, li_data);
        }
        if (li_data && li_data.length) {
            $.each(li_data, function (index, value) {
                insert_token(value);
                checkTokenLimit();
            });
        }

        // Initialization is done
        if ($.isFunction(settings.onReady)) {
            settings.onReady.call();
        }

        //
        // Public functions
        //

        this.clear = function () {
            token_list.children("li").each(function () {
                if ($(this).children("input").length === 0) {
                    delete_token($(this));
                }
            });
        }

        this.add = function (item) {

            add_token(item);
        }

        this.remove = function (item) {
            token_list.children("li").each(function () {
                if ($(this).children("input").length === 0) {
                    var currToken = $(this).data("tokeninput");
                    var match = true;
                    for (var prop in item) {
                        if (item[prop] !== currToken[prop]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        delete_token($(this));
                    }
                }
            });
        }

        this.getTokens = function () {
            return saved_tokens;
        }

        //JB: Added this additional method to return all potentially useful data rather than just selected tokens
        this.getAllData = function () {
            return { input_id: hidden_input.attr("id"), tokens: saved_tokens, inputVal: input_val, selectedItem: $(selected_dropdown_item).data("tokeninput") }
        }

        //JB: Added this additional method to return all potentially useful data rather than just selected tokens
        this.updateDataSource = function (url_or_data) {
            // Configure the data source
            configureDataSource(url_or_data);
        }

        //SPG: Added this additional method to update the hint text based on search type
        this.updateHintText = function (hint_text) {
            // Update Hint Text
            configureHintText(hint_text);
        }


        //
        // Private functions
        //
        function setCaretPosition(elemId, caretPos) {
            var elem = document.getElementById(elemId);

            if (elem != null) {
                if (elem.createTextRange) {
                    var range = elem.createTextRange();
                    range.move('character', elem.value.length);
                    range.select();
                }
                else {
                    if (elem.selectionStart) {
                        elem.focus();
                        elem.setSelectionRange(caretPos, caretPos);
                    }
                    else
                        elem.focus();
                }
            }
        }
        function checkTokenLimit() {
            if (settings.tokenLimit !== null && token_count >= settings.tokenLimit) {
                input_box.hide();
                hide_dropdown();
                return;
            }
        }

        function resize_input() {
            if (input_val === (input_val = input_box.val())) { return; }

            // Enter new content into resizer and resize input accordingly
            var escaped = input_val.replace(/&/g, '&amp;').replace(/\s/g, ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            input_resizer.html(escaped);
            input_box.width(input_resizer.width() + 30);
        }

        function is_printable_character(keycode) {
            return ((keycode >= 48 && keycode <= 90) ||     // 0-1a-z
                (keycode >= 96 && keycode <= 111) ||    // numpad 0-9 + - / * .
                (keycode >= 186 && keycode <= 192) ||   // ; = , - . / ^
                (keycode >= 219 && keycode <= 222));    // ( \ ) '
        }

        // Inner function to a token to the list
        function insert_token(item) {
            var this_token = settings.tokenFormatter(item);
            this_token = $(this_token)
          .addClass(settings.classes.token)
          .insertBefore(input_token);

            // The 'delete token' button
            $("<span>" + settings.deleteText + "</span>")
            .addClass(settings.classes.tokenDelete)
            .appendTo(this_token)
            .click(function () {
                delete_token($(this).parent());
                hidden_input.change();
                return false;
            });

            // Store data on the token
            var token_data = { "id": item.id };
            token_data[settings.propertyToSearch] = item[settings.propertyToSearch];
            $.data(this_token.get(0), "tokeninput", item);

            // Save this token for duplicate checking
            saved_tokens = saved_tokens.slice(0, selected_token_index).concat([token_data]).concat(saved_tokens.slice(selected_token_index));
            selected_token_index++;

            // Update the hidden input
            update_hidden_input(saved_tokens, hidden_input);

            token_count += 1;

            // Check the token limit
            if (settings.tokenLimit !== null && token_count >= settings.tokenLimit) {
                input_box.hide();
                hide_dropdown();
            }

            return this_token;
        }

        // Add a token to the token list based on user input
        function add_token(item) {
            var callback = settings.onAdd;

            // See if the token already exists and select it if we don't want duplicates
            if (token_count > 0 && settings.preventDuplicates) {
                var found_existing_token = null;
                token_list.children().each(function () {
                    var existing_token = $(this);
                    var existing_data = $.data(existing_token.get(0), "tokeninput");
                    if (existing_data && existing_data.id === item.id) {
                        found_existing_token = existing_token;
                        return false;
                    }
                });

                if (found_existing_token) {
                    select_token(found_existing_token);
                    input_token.insertAfter(found_existing_token);
                    input_box.focus();
                    return;
                }
            }

            // Insert the new tokens
            if (settings.tokenLimit == null || token_count < settings.tokenLimit) {
                insert_token(item);
                checkTokenLimit();
            }

            // Clear input box
            input_box.val("");
            input_box.focus(); //-----TT# 552430,552429 ----Avinash
            // Don't show the help dropdown, they've got the idea
            hide_dropdown();

            // Execute the onAdd callback if defined
            if ($.isFunction(callback)) {
                callback.call(hidden_input, item);
            }
        }

        // Select a token in the token list
        function select_token(token) {
            token.addClass(settings.classes.selectedToken);
            selected_token = token.get(0);

            // Hide input box
            input_box.val("");

            // Hide dropdown if it is visible (eg if we clicked to select token)
            hide_dropdown();
        }

        // Deselect a token in the token list
        function deselect_token(token, position) {
            token.removeClass(settings.classes.selectedToken);
            selected_token = null;

            if (position === POSITION.BEFORE) {
                input_token.insertBefore(token);
                selected_token_index--;
            } else if (position === POSITION.AFTER) {
                input_token.insertAfter(token);
                selected_token_index++;
            } else {
                input_token.appendTo(token_list);
                selected_token_index = token_count;
            }

            // Show the input box and give it focus again
            input_box.focus();
        }

        // Toggle selection of a token in the token list
        function toggle_select_token(token) {
            var previous_selected_token = selected_token;

            if (selected_token) {
                deselect_token($(selected_token), POSITION.END);
            }

            if (previous_selected_token === token.get(0)) {
                deselect_token(token, POSITION.END);
            } else {
                select_token(token);
            }
        }

        // Delete a token from the token list
        function delete_token(token) {
            // Remove the id from the saved list
            var token_data = $.data(token.get(0), "tokeninput");
            var callback = settings.onDelete;

            var index = token.prevAll().length;
            if (index > selected_token_index) index--;

            // Delete the token
            token.remove();
            selected_token = null;

            // Show the input box and give it focus again
            input_box.focus();

            // Remove this token from the saved list
            saved_tokens = saved_tokens.slice(0, index).concat(saved_tokens.slice(index + 1));
            if (index < selected_token_index) selected_token_index--;

            // Update the hidden input
            update_hidden_input(saved_tokens, hidden_input);

            token_count -= 1;

            if (settings.tokenLimit !== null) {
                input_box
                .show()
                .val("")
                .focus();
            }

            // Execute the onDelete callback if defined
            if ($.isFunction(callback)) {
                callback.call(hidden_input, token_data);
            }
        }

        // Update the hidden input box value
        function update_hidden_input(saved_tokens, hidden_input) {
            var token_values = $.map(saved_tokens, function (el) {
                return el[settings.tokenValue];
            });
            hidden_input.val(token_values.join(settings.tokenDelimiter));

        }

        // Hide and clear the results dropdown
        function hide_dropdown() {
            dropdown.hide().empty();
            selected_dropdown_item = null;
        }

        function show_dropdown() {
            dropdown
            .css({
                position: "absolute",
                top: $(token_list).offset().top + $(token_list).outerHeight(),
                left: $(token_list).offset().left
            })
            .show();
        }

        function show_dropdown_searching() {
            if (settings.searchingText) {
                dropdown.html("<p>" + settings.searchingText + "</p>");
                show_dropdown();
            }
        }

        function show_dropdown_hint() {
            if (settings.hintText) {
                dropdown.html("<p>" + settings.hintText + "</p>");
                show_dropdown();
            }
        }

        // Highlight the query part of the search term
        // /g : global search, /gi : global insensitive search.
        //http://www.w3schools.com/js/js_obj_regexp.asp
        function highlight_term(value, term) {
            return value.replace(new RegExp(HighlightPattern.format(term), "gi"), "<b>$1</b>");
        }
        function find_value_and_highlight_term(template, value, term) {
            template = template.replace(/#b2/g, '<b>');
            template = template.replace(/#3b2/g, '</b>');
            return template;
        }
        //Added by Sumod
        //This program does a split search ex : smith morgan/ [smith] [morgan]
        function SplitSearch(template, value, term) {
            var strArray = term.replace("%20", " ").split(" ");
            for (var i = 0, length = strArray.length; i < length; i++) {
                template = template.replace(new RegExp(HighlightPattern.format(strArray[0]), "gi"), "<b>$1</b>");
            }
            return template;
        }
        //This function replace all the occurences of the given string.
        function ColdReplace(template, value, term) {
            var pattern = HighlightPattern.format([term]);
            var regEx = new RegExp(pattern, "gi");
            return template.replace(regEx, "<b>$1</b>");
        }

        // Populate the results dropdown with some results
        function populate_dropdown(this_query, query, results) {
            if (results && results.IsSuccess && results.Items.length) {
                dropdown.empty();
                selected_dropdown_item = null; //JB: need to set this back to null since I'm not selecting the 1st item by default below
                var dropdown_ul = $("<ul>")
                .appendTo(dropdown)
                .mouseover(function (event) {
                    select_dropdown_item($(event.target).closest("li"));
                })
                .mousedown(function (event) {
                    //JB: Execute the onResultClick callback if defined
                    var add = true;
                    var callback = settings.onResultClick;
                    if ($.isFunction(callback)) {
                        //Call the supplied callback passing the orig input control back as the "this" param, custom json data, and the event
                        add = callback.call(hidden_input, hidden_input.data("tokenInputObject").getAllData(), event);
                    }

                    if (add) {
                        add_token($(event.target).closest("li").data("tokeninput"));
                        hidden_input.change();
                    }
                    return false;
                })
                .hide();

                //SPG: Grouping Items
                var that = this;
                var currentCategory = "";
                $.each(results.Items, function (index, value) {
                    //SPG: Grouping Items
                    if (value.Type != currentCategory) {
                        dropdown_ul.append("<li class='" + settings.classes.category + "'>" + value.Category + "<span class='add' /></li>");
                        currentCategory = value.Type;
                    }

                    var this_li = settings.resultsFormatter(hidden_input.data("tokenInputObject").getAllData(), value);
                    this_li = $(this_li).appendTo(dropdown_ul);

                    if (index % 2) {
                        this_li.addClass(settings.classes.dropdownItem);
                    } else {
                        this_li.addClass(settings.classes.dropdownItem2);
                    }

                    /*##############################################################################################################
                    JB: Not selecting the 1st item by default.
                    if(index === 0) {
                    select_dropdown_item(this_li);
                    }
                    ###############################################################################################################*/

                    $.data(this_li.get(0), "tokeninput", value);
                });

                show_dropdown();

                if (settings.animateDropdown) {
                    dropdown_ul.slideDown("fast");
                } else {
                    dropdown_ul.show();
                }
            }
            else if (settings.noResultsText) {
                dropdown.html("<p>" + settings.noResultsText + "</p>");
                show_dropdown();
            }
        }

        // Highlight an item in the results dropdown
        function select_dropdown_item(item) {
            if (item) {
                if (selected_dropdown_item) {
                    deselect_dropdown_item($(selected_dropdown_item));
                }

                item.addClass(settings.classes.selectedDropdownItem);
                selected_dropdown_item = item.get(0);
            }
        }

        // Remove highlighting from an item in the results dropdown
        function deselect_dropdown_item(item) {
            item.removeClass(settings.classes.selectedDropdownItem);
            selected_dropdown_item = null;
        }

        // Do a search and show the "searching" dropdown if the input is longer
        // than settings.minChars
        function do_search() {
            var query = '';
            var this_query = input_box.val().trim().toLowerCase();

            if (settings.multiInput && $.isFunction(settings.queryGetter))
            //Added by sumod for Advanced search highlight.
                query = settings.queryGetter.call(hidden_input) + "*" + this_query;
            else
                query = this_query;

            if (query && query.length) {
                if (selected_token) {
                    deselect_token($(selected_token), POSITION.AFTER);
                }

                if (this_query.length >= settings.minChars) {
                    show_dropdown_searching();
                    clearTimeout(timeout);

                    timeout = setTimeout(function () {
                        run_search(this_query, query);
                    }, settings.searchDelay);
                } else {
                    hide_dropdown();
                }
            }
        }

        // Do the actual search
        function run_search(this_query, query) {
            var cache_key = query + computeURL();
            var cached_results = cache.get(cache_key);
            if (cached_results) {
                populate_dropdown(this_query, query, cached_results);
            } else {
                // Are we doing an ajax search or local data search?
                if (settings.url) {
                    var url = computeURL();
                    // Extract exisiting get params
                    var ajax_params = {};
                    ajax_params.data = {};
                    ajax_params.cache = false;
                    if (url.indexOf("?") > -1) {
                        var parts = url.split("?");
                        ajax_params.url = parts[0];

                        var param_array = parts[1].split("&");
                        $.each(param_array, function (index, value) {
                            var kv = value.split("=");
                            ajax_params.data[kv[0]] = kv[1];
                        });
                    } else {
                        ajax_params.url = url;
                    }

                    // Prepare the request
                    ajax_params.data[settings.queryParam] = encodeURI(query); ;
                    ajax_params.type = settings.method;
                    ajax_params.dataType = settings.contentType;
                    if (settings.crossDomain) {
                        ajax_params.dataType = "jsonp";
                    }

                    // Attach the success callback
                    ajax_params.success = function (results) {
                        if (settings.isNavigating)
                            return false;

                        if ($.isFunction(settings.onResult)) {
                            results = settings.onResult.call(hidden_input, results);
                        }

                        else {

                            //Turning off browser cache
                            //SPG: Add to cache only for valid results, allowing a requery next time
                            //	if (results && results.data && results.data.length)
                            //		cache.add(cache_key, settings.jsonContainer ? results[settings.jsonContainer] : results);

                            var is_active = $(document.activeElement).attr("id") == input_box.attr("id");

                            //SPG: Do this only if focus is on the current element (to handle multipe inputs)
                            if (is_active) {
                                // only populate the dropdown or show error if the results are associated with the active search query
                                var currentQuery;
                                if (settings.multiInput && $.isFunction(settings.queryGetter)) //Added by sumod to match the query.
                                    currentQuery = settings.queryGetter.call(hidden_input) + "*" + input_box.val().trim().toLowerCase();
                                else
                                    currentQuery = input_box.val().trim().toLowerCase();

                                if (currentQuery === query) {

                                    if (results && results.ErrorCode && results.ErrorCode == "1") {
                                        var callback = settings.onAjaxError;
                                        if ($.isFunction(callback)) {
                                            hide_dropdown(); //SPG: Hide the dropdown if error & handler is present
                                            //Call the supplied ajax error callback
                                            callback.call(hidden_input, null, null, results.Log);
                                        }

                                        dropdown.html("<p>" + settings.errorText + "</p>");
                                        show_dropdown();
                                    }
                                    else {
                                        populate_dropdown(this_query, query, settings.jsonContainer ? results[settings.jsonContainer] : results);

                                        if ($.isFunction(settings.onSuccess) && results)
                                            settings.onSuccess.call(hidden_input, results.Log);
                                    }
                                }
                            }
                        }
                    };

                    //##############################################################################################################
                    //JB: Adding for debugging 
                    // Attach the error callback
                    ajax_params.error = function (jqXHR, textStatus, errorThrown) {
                        var is_active = $(document.activeElement).attr("id") == input_box.attr("id");

                        //SPG: Do this only if focus is on the current element (to handle multipe inputs)
                        if (is_active) {
                            //SPG:Do this only if the error is for current search term
                            var currentQuery;
                            if (settings.multiInput && $.isFunction(settings.queryGetter))
                                currentQuery = settings.queryGetter.call(hidden_input);
                            else
                                currentQuery = input_box.val().trim().toLowerCase();

                            if (currentQuery === query) {
                                var callback = settings.onAjaxError;
                                if ($.isFunction(callback)) {
                                    hide_dropdown(); //SPG: Hide the dropdown if error & handler is present
                                    //Call the supplied ajax error callback
                                    callback.call(hidden_input, jqXHR, textStatus, errorThrown);
                                }

                                //SPG: Show error text in the dropdown if error 
                                dropdown.html("<p>" + settings.errorText + "</p>");
                                show_dropdown();
                            }
                        }
                    };
                    //##############################################################################################################

                    // Make the request
                    $.ajax(ajax_params);
                } else if (settings.local_data) {
                    // Do the search through local data
                    var results = $.grep(settings.local_data, function (row) {
                        return row[settings.propertyToSearch].toLowerCase().indexOf(query.toLowerCase()) > -1;
                    });

                    if ($.isFunction(settings.onResult)) {
                        results = settings.onResult.call(hidden_input, results);
                    }
                    cache.add(cache_key, results);
                    populate_dropdown(this_query, query, results);
                }
            }
        }

        function configureDataSource(url_or_data) {
            if ($.type(url_or_data) === "string" || $.type(url_or_data) === "function") {
                // Set the url to query against
                settings.url = url_or_data;

                // If the URL is a function, evaluate it here to do our initalization work
                var url = computeURL();

                // Make a smart guess about cross-domain if it wasn't explicitly specified
                if (settings.crossDomain === undefined) {
                    if (url.indexOf("://") === -1) {
                        settings.crossDomain = false;
                    } else {
                        settings.crossDomain = (location.href.split(/\/+/g)[1] !== url.split(/\/+/g)[1]);
                    }
                }
            } else if (typeof (url_or_data) === "object") {
                // Set the local data to search through
                settings.local_data = url_or_data;
            }
        }

        function configureHintText(hint_text) {
            if ($.type(url_or_data) === "string")
                settings.hintText = hint_text;
        }

        // compute the dynamic URL
        function computeURL() {
            var url = settings.url;
            if (typeof settings.url == 'function') {
                url = settings.url.call();
            }
            return url;
        }
    };

    // Really basic cache for the results
    $.TokenList.Cache = function (options) {
        var settings = $.extend({
            max_size: 500
        }, options);

        var data = {};
        var size = 0;

        var flush = function () {
            data = {};
            size = 0;
        };

        this.add = function (query, results) {
            if (size > settings.max_size) {
                flush();
            }

            if (!data[query]) {
                size += 1;
            }

            data[query] = results;
        };

        this.get = function (query) {
            return data[query];
        };
    };
} (jQuery));
