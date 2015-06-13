'use strict';

var level = 0;
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

var init_puzzle = function (title, content, hint) {
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
                    .attr('type', 'button')
                    .val('Go!')
                    .click(function () {
                        ++level;
                        load_puzzle($('#key').val());
                        // for (level in level_data) {
                        //     load_puzzle($('#key').val());
                        // }
                    })
            )
    );
};
