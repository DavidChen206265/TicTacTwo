Parse.initialize("D6oCmRykTvuUH1PUz6ADNpByJcHv85mZC8xf0r5B", "q0nFa7hEpDk1lT3hAUr1rcQsosKq1OEwGoqlchsz");
Parse.serverURL = 'https://parseapi.back4app.com/';

let currentPlayer = 'X';
let gameId = '';  // Unique game ID
let players = 0;  // Track the number of players

const Game = Parse.Object.extend("Game");

// Create a new game session
async function createGame() {
    try {
        const game = new Game();
        game.set('board',  [ '', '', '', '', '', '', '', '', '' ] );
        game.set('currentPlayer', currentPlayer);
        game.set('players',  [currentPlayer] );
        game.set('winner', null);

        const gameObject = await game.save();
        gameId = gameObject.id;
        players = 1;  // First player has joined
        console.log("Game created with ID:", gameId);
    } catch (error) {
        console.error("Error creating game:", error);
    }
}

// Join an existing game
async function joinGame(gameKey) {
    try {
        const gameQuery = new Parse.Query(Game);
        const game = await gameQuery.get(gameKey);
        
        if (!game) {
            alert('Game does not exist!');
            return;
        }
        
        players = 2;
        currentPlayer = game.get('currentPlayer') === 'X' ? 'O' : 'X';
    } catch (error) {
        console.error("Error joining game:", error);
    }
}

// Update the game board
async function updateBoard(index) {
    try {
        const gameQuery = new Parse.Query(Game);
        const game = await gameQuery.get(gameId);
        const board = game.get('board');

        if (board[index] !== '' || game.get('winner')) {
            return;
        }

        const newBoard = [...board];
        newBoard[index] = currentPlayer;

        game.set('board', newBoard);
        game.set('currentPlayer', currentPlayer === 'X' ? 'O' : 'X');

        await game.save();
        checkWinner(newBoard);
    } catch (error) {
        console.error("Error updating board:", error);
    }
} // updateBoard

// Check for a winner
async function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]              // Diagonals
    ];

    for (var i = 0; i < winPatterns.length; i++) {
        var a = winPatterns[i][0];
        var b = winPatterns[i][1];
        var c = winPatterns[i][2];

        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            try {
                var gameQuery = new Parse.Query(Game);
                var game = await gameQuery.get(gameId);
                
                game.set('winner', currentPlayer);
                await game.save();
                
                alert(currentPlayer + " wins!");
            } catch (error) {
                console.error("Error saving winner:", error);
            }
            return;
        }
    }

    // Check for draw
    if (board.every(function (cell) { return cell !== ''; })) {
        try {
            var gameQuery = new Parse.Query(Game);
            var game = await gameQuery.get(gameId);
            
            game.set('winner', 'Draw');
            await game.save();
            
            alert("It's a draw!");
        } catch (error) {
            console.error("Error saving draw result:", error);
        }
    }
} // checkWinner

// Render the game board
async function renderBoard() {
    try {
        const gameQuery = new Parse.Query(Game);
        const game = await gameQuery.get(gameId);
        const board = game.get('board');
        const cells = document.querySelectorAll('.cell');

        board.forEach(function (cell, index) {
            cells[index].innerHTML = cell;
        });
    } catch (error) {
        console.error("Error rendering board:", error);
    }
} // renderBoard

// Initialize the game 
function initializeGame() {
    document.querySelectorAll('.cell').forEach(function (cell) {
        cell.addEventListener('click', function (e) {
            var index = e.target.getAttribute('data-index');
            updateBoard(index);
            console.log("Cell clicked at index:", index);
        });
    });

    document.getElementById('reset-btn').addEventListener('click', function () {
        resetGame();
    });

    createGame();
} // initializeGame

// start when the page loads
window.onload = function () {
    initializeGame();
};