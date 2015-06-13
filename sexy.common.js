'use strict';

var level = 0;
var level_load = undefined;
var level_data = undefined;

var init_key = 'hello';
var last_key = init_key;

var gen_puzzle = function (code, key) {
    var result = CryptoJS.AES.encrypt(code, last_key).toString();

    last_key = key;

    return result;
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

var init_puzzle = function (title, content, hint, canjump) {
    level_load = level;

    $('#puzzle').empty();

    if (title) {
        $('#puzzle').append(
            $('<h2 />')
                .text('Level ' + level + ': ' + title)
        );
    }

    if (content) {
        $('#puzzle').append(
            $('<div />')
                .append(content)
        );
    }

    $('#puzzle').append(
        $('<div />')
            .append(
                $('<input />')
                    .attr('id', 'key')
                    .attr('type', 'text')
                    .val(hint ? hint : '')
            )
            .append(
                $('<input />')
                    .attr('id', 'go')
                    .attr('type', 'button')
                    .val('Go!')
                    .click(function () {
                        if (canjump) {
                            for (var i in level_data) {
                                level = parseInt(i);
                                load_puzzle($('#key').val());
                            }
                        } else {
                            level = level_load + 1;
                            load_puzzle($('#key').val());
                        }
                    })
            )
    );
};
