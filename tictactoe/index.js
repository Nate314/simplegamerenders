var xColor = 'blue';
var oColor = 'red';
var defaultColor = 'black';

function getParams(url) {
	var params = {};
	var parser = document.createElement('a');
	parser.href = url;
	var query = parser.search.substring(1);
	var vars = query.split('&');
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		params[pair[0]] = decodeURIComponent(pair[1]);
	}
	return params;
};

function row(inner, classes, height) {
    return `<div class="row ${classes}"
        style="height:${height}px;
        line-height:${0.75 * height}px;
        text-align:center;
        font-size:${(height * height * height * height) / 1000000}%"
        >${inner}</div>`;
}

function col(inner, classes) {
    return `<div class="col ${classes}"
    style="color:${inner == 'x' ? xColor : (inner == 'o' ? oColor : defaultColor)};"
    >${inner}</div>`;
}

function tictactoeHTML(board, h) {
    const classes = 'border border-dark';
    const row1 = `${col(board[0], classes)}${col(board[1], classes)}${col(board[2], classes)}`;
    const row2 = `${col(board[3], classes)}${col(board[4], classes)}${col(board[5], classes)}`;
    const row3 = `${col(board[6], classes)}${col(board[7], classes)}${col(board[8], classes)}`;
    return `${row(row1, '', h)}${row(row2, '', h)}${row(row3, '', h)}`;
}

const params = getParams(location.href);
const colorsParam = params.colors.split('.');
if (colorsParam && colorsParam.length === 3) {
    xColor = colorsParam[0];
    oColor = colorsParam[1];
    defaultColor = colorsParam[2];
}
const boardParam = params.board.split('.');
const board = [];
boardParam.forEach(section => {
    if (section.length == 1) {
        board.push(section);
    } else {
        board.push(tictactoeHTML(section, 60));
    }
});
document.getElementById('body').innerHTML = tictactoeHTML(board, 182);