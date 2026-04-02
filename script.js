import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = "https://pyoiawasdbkiifrpzrjd.supabase.co";
const supabaseKey = "sb_publishable_K29_2-qfcStEZOOMv7bksA_d238a-kN";
const supabase = createClient(supabaseUrl, supabaseKey);

// ui
const cells = document.querySelectorAll('.cell');
const initButton = document.getElementById('init-btn');
const joinButton = document.getElementById('join-btn');
const resetButton = document.getElementById('reset-btn');
const winnerDisplay = document.getElementById('winner-display');

// timer
let counter = '';

// game
let currentRoom = -1;
let currentPlayer = '';
let thisPlayer = '';
let thisPlayerName = '';
let board = ['', '', '', '', '', '', '', '', ''];
let players = ['', ''];
let vote = ['', ''];
let message = '';
const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]              // Diagonals
];
let gameWinner = '';


// add eventListeners
initButton.addEventListener('click', initGame);
joinButton.addEventListener('click', joinRoom);
resetButton.addEventListener('click', resetGame);

cells.forEach((cell) => {
    cell.addEventListener('click', (event) => {
        let index = event.target.id;
        updateBoard(index);
    });
});


async function getRoomNumber() {
    const { data, error } = await supabase.from("Game").select();

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    console.log(data.length);
    return data.length;
} // getRoomNumber

async function getRoomData(room) {
    const { data, error } = await supabase.from("Game").select().eq('room', room);

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    // console.log(data[room]);
    return data[0];
} // getRoomData

async function initGame() {

    // get the new room's index
    let newRoom = await getRoomNumber();

    if (!newRoom) {
        console.error('Can not init a room');
    }

    // add a new room (row) into the table
    const { data, error } = await supabase.from("Game").insert({ room: newRoom, board: board, currentPlayer: 'X', players: ['X'], winner: '', vote: ['', ''], message: '' }).select();

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    // set current room & current player
    currentRoom = newRoom;
    currentPlayer = 'X';
    thisPlayer = 'X';

    // start timer
    counter = window.setInterval(() => syncWithServer(currentRoom), 1000);

    console.log('New room is created: \n', data[0]);
    return data[0];
} // initGame

async function joinRoom() {

    let room = document.getElementById("roomInput").value;

    // check for valid room id
    let maxRoom = (await getRoomNumber()) - 1;

    if (room > maxRoom) {
        console.warn('room does not exist');
        return;
    }

    currentRoom = room;
    thisPlayer = 'O';

    await syncWithServer(currentRoom);
    counter = window.setInterval(() => syncWithServer(currentRoom), 1000);

    console.log('joined room ' + room);
}

// make a move and update board
async function updateBoard(index) {
    console.log('currentPlayer - ' + currentPlayer + ' thisPlayer - ' + thisPlayer);


    // check for valid room id & currentPlayer
    if (currentRoom === -1 || currentPlayer != thisPlayer) {
        console.log('invalid currentRome / currentPlayer');

        return;
    }

    if (gameWinner != '') {
        console.log('Game is ended');
        return;
    }

    await syncWithServer(currentRoom);

    let winner = '';

    // update board
    if (board[index] === '') {
        console.log('board updated at index ' + index);

        board[index] = currentPlayer;
        cells[index].innerHTML = currentPlayer;

        // check for tie
        for (let i = 0; i < 9; i++) {
            if (board[i] == '') break;
            if (i === 8) winner = 'Tie';
        }

        // check for winner
        for (let i = 0; i < winPatterns.length; i++) {
            let a = winPatterns[i][0];
            let b = winPatterns[i][1];
            let c = winPatterns[i][2];

            if (board[a] === thisPlayer && board[a] === board[b] && board[a] === board[c]) {
                winner = thisPlayer;
            } // if
        } // for i

    } else {
        console.log('clicked on existing X or O');

        return;
    }

    // update client
    currentPlayer = (currentPlayer === 'X' ? 'O' : 'X');

    // update server
    const { data, error } = await supabase.from("Game").update({ board: board, currentPlayer: currentPlayer, winner: winner })
        .eq('room', currentRoom).select();

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    await syncWithServer(currentRoom);

} // updateBoard

async function syncWithServer(room) {
    let data = await getRoomData(room);

    if (data) {
        console.log('server data currentPlayer: ', data.currentPlayer);
        console.log('server data board: ', data.board);
        console.log('sync success');

    } else {
        console.error('error syncWithServer');
        return;
    }

    // update board & currentPlayer
    board = data.board;
    currentPlayer = data.currentPlayer;

    for (let i = 0; i < 9; i++) {
        cells[i].innerHTML = data.board[i];
    }

    // display winner
    if (data.winner != '') {
        winnerDisplay.innerHTML = 'Winner ' + data.winner;
        gameWinner = data.winner;
    }

} // syncWithServer

async function resetGame() {
    currentPlayer = 'X';
    thisPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    const { data, error } = await supabase.from("Game").update({ board: board, currentPlayer: currentPlayer, winner: '', vote: ['', ''], message: '' })
        .eq('room', currentRoom).select();
}
