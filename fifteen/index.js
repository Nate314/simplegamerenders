let color = 'red';

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

function col(inner, classes, h) {
    inner = `<span style="font-size:${h / 2}px;
                        position:absolute;
                        transform:translate(-20px,20px);">${inner}</span>`;
    return `<div class="col ${classes}"
        style="color:${color};">${inner}</div>`;
}

function gridHTML(board, h, size) {
    const classes = 'border';
    console.log(board);
    const sqrt = Math.sqrt(size);
    const rows = Array(sqrt).fill(null).map((v, i) =>
        Array(sqrt).fill(null).map((_, j) =>
            col(board[(sqrt * i) + j], classes, h)
        ).join('')
    );
    return rows.map(r => row(r, '', h)).join('');
}

const params = getParams(location.href);
const colorsParam = params.colors.split('.');
if (colorsParam && colorsParam.length === 1) {
    color = colorsParam[0];
}
const board = params.board.split('.');
const len = board.length;
document.getElementById('body').innerHTML = gridHTML(board, (546 / Math.sqrt(len)), len);
