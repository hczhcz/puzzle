'use strict';

var level = 0;
var level_load = undefined;
var level_data = undefined;

var last_key = 'hello';

var gen_puzzle = function (code, key) {
    var result = CryptoJS.AES.encrypt(code, last_key).toString();

    last_key = key;

    return result;
};

var gen_salt = function (key) {
    return 'salt_' + key + key + key;
};

var load_puzzle = function (key) {
    try {
        eval(
            CryptoJS
                .AES
                .decrypt(level_data[level], key)
                .toString(CryptoJS.enc.Utf8)
        );
    } catch (e) {
        // ignore
    }
};

var load_next = function () {
    level = level_load + 1;
    load_puzzle($('#key').val().toLowerCase());
};

var load_next_salt = function () {
    level = level_load + 1;
    load_puzzle(gen_salt($('#key').val().toLowerCase()));
};

var load_any = function () {
    for (var i in level_data) {
        level = parseInt(i);
        load_puzzle($('#key').val().toLowerCase());
    }
};

var init_puzzle = function (title, content, hint, loader) {
    level_load = level;

    $('#puzzle').empty();

    if (title) {
        $('#puzzle').append(
            $('<h2 />')
                .attr('id', 'title')
                .text('Level ' + level + ': ' + title)
        );
    }

    if (content) {
        $('#puzzle').append(
            $('<div />')
                .append(content)
        );
    } else {
        $('#puzzle').append(
            $('<div />')
                .append(" ")
        );
    }

    $('#puzzle').append(
        $('<div />')
            .append(
                $('<input />')
                    .attr('id', 'key')
                    .attr('type', 'text')
                    .val(hint ? hint : '')
                    .keypress(function (e) {
                        if (e.which == 13) {
                            $('#go').click();
                        }
                    })
            )
            .append(
                $('<input />')
                    .attr('id', 'go')
                    .attr('type', 'button')
                    .val('Go!')
                    .click(loader ? loader : load_next)
            )
    );

    $('#key').select();
};
