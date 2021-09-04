let xColor = 'blue';
let oColor = 'red';
let defaultColor = 'black';

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
	
const div = (className, backgroundColor) => {
	const el = document.createElement('div');
	el.classList.add(className);
	el.style.backgroundColor = backgroundColor;
	return el;
};

const appendChildren = (element, children) => children.forEach(child => element.appendChild(child));

function mancalaHTML(board, xColor, oColor) {
	const [ player1Bank, ...player1Pits ] = board.splice(0, 7).map(x => +x);
	const [ player2Bank, ...player2Pits ] = board.map(x => +x);
	console.log('player1', xColor, player1Bank, player1Pits);
	console.log('player2', oColor, player2Bank, player2Pits);

	const addSeedsToElement = (element, seedCount) => {
		Array(seedCount).fill(0).forEach(() => {
			element.appendChild(div('seed'));
		});
	};

	const addPitsToElement = (element, seedCounts, color) => {
		seedCounts.forEach(seedCount => {
			const pit = div('pit', color);
			addSeedsToElement(pit, seedCount);
			element.appendChild(pit);
		});
	};

	const body = div('body');
	const bank1 = div('bank', xColor);
	const bank2 = div('bank', oColor);
	addSeedsToElement(bank1, player1Bank);
	addSeedsToElement(bank2, player2Bank);
	const boardRows = div('board-rows');
	const boardRow1 = div('board-row');
	const boardRow2 = div('board-row');
	addPitsToElement(boardRow1, player1Pits, xColor);
	addPitsToElement(boardRow2, player2Pits, oColor);
	appendChildren(boardRows, [boardRow2, boardRow1]);
	appendChildren(body, [bank1, boardRows, bank2]);

    return body.innerHTML;
}

const params = getParams(location.href);
console.log(params);
const colorsParam = params.colors.split('.');
console.log(colorsParam);
if (colorsParam && colorsParam.length === 2) {
    xColor = colorsParam[0];
    oColor = colorsParam[1];
}
const boardParam = params.board.split('.');
const board = [];
document.getElementById('body').innerHTML = mancalaHTML(boardParam, xColor, oColor);
