import { createClient } from "https://esm.sh/@supabase/supabase-js";

// connect to supabase project
const supabaseUrl = "https://pyoiawasdbkiifrpzrjd.supabase.co";
const supabaseKey = "sb_publishable_K29_2-qfcStEZOOMv7bksA_d238a-kN";
const supabase = createClient(supabaseUrl, supabaseKey);

// ui elements
const cells = document.querySelectorAll('.cell');
const initButton = document.getElementById('init-btn');
const joinButton = document.getElementById('join-btn');
const resetButton = document.getElementById('reset-btn');
const exitButton = document.getElementById('exit-btn');
const winnerDisplay = document.getElementById('winner-display');
const roomDisplay = document.getElementById('room-display');
const nameButton = document.getElementById('name-btn');
const roomInput = document.getElementById("roomInput");
const confettiButton = document.getElementById("confettibtn");

// timer variable for syncWithServer()
let counter = '';
let syncInterval = 1000; // the interval to update the room variables to the states of server

// room variables (corresponding to columns in the Game table, they will be updated in syncWithServer(currentRoom))
let currentPlayer = ''; // the side of player who should make the next move; value: 'X' or 'O'
let board = ['', '', '', '', '', '', '', '', '']; // value: '', 'X', or 'O'
let players = ['', '']; // players' names; players[0] = name of X side player; players[1] = name of O side player
let vote = ['', '']; 
let message = '';
let winner = ''; // winner of game; value: 'X' or 'O'

// client variable
let currentRoom = -1; // the current room number (the index/row number in the Game table)
let thisPlayer = ''; // the side of this client; value: 'X' or 'O'
let thisPlayerName = ''; // name of this client, can be customized

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// add eventListeners
// buttons
initButton.addEventListener('click', initGame);
joinButton.addEventListener('click', joinRoom);
resetButton.addEventListener('click', resetGame);
exitButton.addEventListener('click', exitGame);
nameButton.addEventListener('click', updateName);
confettiButton.addEventListener('click', launchConfetti);

// cells
cells.forEach((cell) => {
    cell.addEventListener('click', (event) => {
        let index = event.target.id;
        updateBoard(index);
    });
});

function launchConfetti(winner){
    for(let i = 0; i < 100; i++){
    confetti({
        particleCount: 6,
        spread: 170,
        origin: { y: 0, x: Math.random() },
        angle:270,
        startVelocity:(Math.random() * 48 - 5),
        ticks:300
      });
    }
}


// returns the current number of rooms (rows) in the Game table
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


// returns a specific row of the Game table (the data of the specific room)
// returning pattern: 
//          call:       getRoomData(12);
//          return:     { room: 12, board: [,,X,,O,O,X,,], currentPlayer: 'X', players: ['playerX','playerO'], winner: '', vote: ['', ''], message: '' }
// takes in the room number 
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

// initialize the game (create a new room)
async function initGame() {

    lock();
    // get the new room's index
    let newRoom = await getRoomNumber();

    if (!newRoom) {
        console.error('Can not init a room');
        unlock();
    }

    // check for player name
    if (thisPlayerName == '') {
        thisPlayerName = 'playerX';
    }

    // initialize players
    players = [thisPlayerName, '']

    // add a new room (row) into the table
    const { data, error } = await supabase.from("Game").insert({ room: newRoom, board: board, currentPlayer: 'X', players: players, winner: '', vote: ['', ''], message: '' }).select();

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        unlock();
        return;
    }

    // initialize current room & current player
    currentRoom = newRoom;
    currentPlayer = 'X';
    thisPlayer = 'X';

    // display current room
    roomDisplay.innerHTML = 'Room: ' + currentRoom;

    // start timer
    // synchronize with server every syncInterval
    counter = window.setInterval(() => syncWithServer(currentRoom), syncInterval);

    console.log('New room is created: \n', data[0]);
    return data[0];
} // initGame

// join an existing room
async function joinRoom() {

    lock();
    // get the room number from the input
    let room = roomInput.value;
    if(room == ""){
        room = 0;
    }

    // check for valid room id
    let maxRoom = (await getRoomNumber()) - 1;

    if (room > maxRoom) {
        alert('Room does not exist');
        unlock();
        return;
    }

    // check for empty spaces in the room and assign a side (X or O) to the new player
    let roomData = await getRoomData(room);

    if (roomData.players[0] == '') {

        // assign the new player to X side if X does not exist
        console.log('join as player X');

        thisPlayer = 'X';

        if (thisPlayerName == '') {
            thisPlayerName = 'playerX';
        }

        roomData.players[0] = thisPlayerName;
    } else if (roomData.players[1] == '') {

        // assign the new player to O side if X exists
        console.log('join as player O');

        thisPlayer = 'O';

        if (thisPlayerName == '') {
            thisPlayerName = 'playerO';
        }

        roomData.players[1] = thisPlayerName;
    } else {

        // reject the player to join this room if the room is full
        alert('Room ' + room + ' is full!');
        unlock();
        return;
    }

    // put the player into room
    currentRoom = room;

    // update server side player info
    const { data, error } = await supabase.from("Game").update({ players: roomData.players })
        .eq('room', currentRoom).select();

    await syncWithServer(currentRoom);

    // start the timer to sync with server
    counter = window.setInterval(() => syncWithServer(currentRoom), syncInterval);

    // display current room
    roomDisplay.innerHTML = 'Room: ' + currentRoom;

    console.log('joined room ' + room);
}

// update the room when thisPlayer makes a move
async function updateBoard(index) {

    // check for valid room id & currentPlayer
    if (currentRoom === -1 || currentPlayer != thisPlayer) {
        console.log('invalid currentRoom / currentPlayer');

        return;
    }

    // check for whether the game is ended
    if (winner != '') {
        console.log('Game is ended');
        return;
    }

    await syncWithServer(currentRoom);

    // check for whether the place is empty and update the board
    if (board[index] === '') { 

        // update the board
        board[index] = currentPlayer;
        cells[index].innerHTML = currentPlayer;

        console.log('board updated at index ' + index);

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
                launchConfetti();
            } // if
        } // for i

    } else {

        // reject the move if clicked on an existing X or O
        console.log('clicked on existing X or O');
        return;
    }

    // update client side's currentPlayer
    currentPlayer = (currentPlayer === 'X' ? 'O' : 'X');

    // update server (upload the client's state to server)
    const { data, error } = await supabase.from("Game").update({ board: board, currentPlayer: currentPlayer, winner: winner })
        .eq('room', currentRoom).select();

    // check for errors
    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    await syncWithServer(currentRoom);

} // updateBoard

// synchronize the client variables to the current stage of the room on server
// takes in the room number
async function syncWithServer(room) {
    let data = await getRoomData(room);

    if (data) {
        console.log('server players in room: ', data.players);
        console.log('sync success');

    } else {
        console.error('error syncWithServer');
        return;
    }

    // update board & currentPlayer
    board = data.board;
    currentPlayer = data.currentPlayer;
    players = data.players;
    vote = data.vote;
    message = data.message;

    // update the cells
    for (let i = 0; i < 9; i++) {
        cells[i].innerHTML = data.board[i];
    }

    // display winner
    if (data.winner != '') {
        winnerDisplay.innerHTML = 'Winner ' + data.winner;
        winner = data.winner;
    } else {
        winner = '';
    }

} // syncWithServer

// reset the room to the initial setup
async function resetGame() {
    // reset client variables
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    vote = ['', ''];
    message = '';
    winner = '';
    const { data, error } = await supabase.from("Game").update({ board: board, currentPlayer: currentPlayer, winner: '', vote: ['', ''], message: '' })
        .eq('room', currentRoom).select();
}

// exist from the current room
async function exitGame() {

    // return if player is not in a room
    if (currentRoom == -1) return;

    // reset all client variables
    currentPlayer = '';
    board = ['', '', '', '', '', '', '', '', ''];
    vote = ['', ''];
    message = '';
    winner = '';

    // remove thisPlayer from players
    if (thisPlayerName == players[0]) {
        players[0] = '';
        console.warn('playerX exits');

    } else if (thisPlayerName == players[1]) {
        players[1] = '';
        console.warn('playerO exits');

    } else {
        console.warn('player does not match');
    }

    // update server status
    const { data, error } = await supabase.from("Game").update({ players: players, vote: ['', ''], message: '' })
        .eq('room', currentRoom).select();

    // end counter, stop to sync with server
    window.clearInterval(counter);

    players = ['', ''];
    thisPlayer = '';
    if(thisPlayerName == "playerX" || thisPlayerName == "playerO"){
        thisPlayerName = '';
    }

    currentRoom = -1;

    // reset roomDisplay
    roomDisplay.innerHTML = "Room:";

    console.log('Exit from room');
    unlock();
}

function unlock(){
    initButton.addEventListener('click', initGame);
    joinButton.addEventListener('click', joinRoom);
    initButton.style.backgroundColor = "rgb(69, 153, 69)";
    joinButton.style.backgroundColor = "rgb(69, 153, 69)";
}

function lock(){
    initButton.removeEventListener('click', initGame);
    joinButton.removeEventListener('click', joinRoom);
    initButton.style.backgroundColor = "#999";
    joinButton.style.backgroundColor = "#999";
}

async function updateName(){
    thisPlayerName = roomInput.value;
    if(currentRoom != -1){
        let currentNames = [];
        if(thisPlayer == "X"){
            players[0] = thisPlayerName;
        }else{
            players[1] = thisPlayerName;
        }

        const { data, error } = await supabase.from("Game").update({ players: players })
        .eq('room', currentRoom).select();

        await syncWithServer(currentRoom);
    }
}