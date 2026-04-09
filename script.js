import { createClient } from "https://esm.sh/@supabase/supabase-js";

// connect to supabase project
const supabaseUrl = "https://pyoiawasdbkiifrpzrjd.supabase.co";
const supabaseKey = "sb_publishable_K29_2-qfcStEZOOMv7bksA_d238a-kN";
const supabase = createClient(supabaseUrl, supabaseKey);

// ui elements
const activatedButtonColor = 'rgb(69, 153, 69)';
const deactivatedButtonColor = '#999';

const cells = document.querySelectorAll('.cell');

const initButton = document.getElementById('init-btn');
const joinButton = document.getElementById('join-btn');
const resetButton = document.getElementById('reset-btn');
const exitButton = document.getElementById('exit-btn');
const nameButton = document.getElementById('name-btn');
const messageButton = document.getElementById('message-btn');

const playerDisplay = document.getElementById('player-display');
const winnerDisplay = document.getElementById('winner-display');
const roomDisplay = document.getElementById('room-display');
const messageDisplay = document.getElementById('message-display');

const roomInput = document.getElementById("roomInput");

// timer variable for syncWithServer()
let counter = '';
let syncInterval = 1000; // the interval to update the room variables to the states of server

// room variables (corresponding to columns in the Game table, they will be updated in syncWithServer(currentRoom))
let currentPlayer = ''; // the side of player who should make the next move; value: 'X' or 'O'
let board = ['', '', '', '', '', '', '', '', '']; // value: '', 'X', or 'O'
let players = ['', '']; // players' names; players[0] = name of X side player; players[1] = name of O side player
let vote = ['', '']; 
let message = '';
let winner = ''; // winner of game; value: 'X', 'O', or 'Tie'

// client variable
let currentRoom = -1; // the current room number (the index/row number in the Game table)
let thisPlayer = ''; // the side of this client; value: 'X' or 'O'
let thisPlayerName = ''; // name of this client, can be customized
let historicalMessages = new Set(); // historical messages

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
messageButton.addEventListener('click', sendMessage);

// init cells
cells.forEach((cell) => {
    cell.addEventListener('click', (event) => {
        let index = event.target.id;
        updateBoard(index);
    });
});

// init buttons
setButtonStateOutsideRoom();

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

    setButtonStateInsideRoom();
    // get the new room's index
    let newRoom = await getRoomNumber();

    if (!newRoom) {
        console.error('Can not init a room');
        setButtonStateOutsideRoom();
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
        setButtonStateOutsideRoom();
        return;
    }

    // initialize current room & current player
    currentRoom = newRoom;
    currentPlayer = 'X';
    thisPlayer = 'X';

    // display current room
    roomDisplay.innerHTML = 'Room: ' + currentRoom;

    // update player display
    playerDisplay.innerHTML = thisPlayerName + '(X)(me) vs empty(O)'

    // start timer
    // synchronize with server every syncInterval
    counter = window.setInterval(() => syncWithServer(currentRoom), syncInterval);

    console.log('New room is created: \n', data[0]);
    return data[0];
} // initGame

// join an existing room
async function joinRoom() {

    setButtonStateInsideRoom();
    // get the room number from the input
    let room = Number(roomInput.value);
    console.log('test: ' + room);
    
    // check for valid room number input
    if(!room){
        alert('Please enter a valid room number.');
        setButtonStateOutsideRoom();
        // reset input
        roomInput.value = '';
        return;
    }

    // check for valid room id
    let maxRoom = (await getRoomNumber()) - 1;

    if (room < 0 || room > maxRoom) {
        alert('Room does not exist.');
        setButtonStateOutsideRoom();
        // reset input
        roomInput.value = '';
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

        // update player display
        playerDisplay.innerHTML = thisPlayerName + '(X)(me) vs ' + (roomData.players[1] == '' ? 'empty' : roomData.players[1]) + '(O)';

        roomData.players[0] = thisPlayerName;
    } else if (roomData.players[1] == '') {

        // assign the new player to O side if X exists
        console.log('join as player O');

        thisPlayer = 'O';

        if (thisPlayerName == '') {
            thisPlayerName = 'playerO';
        }

        // update player display
        playerDisplay.innerHTML = roomData.players[0] + '(X) vs ' + thisPlayerName + '(O)(me)';

        roomData.players[1] = thisPlayerName;
    } else {

        // reject the player to join this room if the room is full
        alert('Room ' + room + ' is full!');
        setButtonStateOutsideRoom();
        // reset input
        roomInput.value = '';
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

    // reset input
    roomInput.value = '';

    console.log('joined room ' + room);
}

// update the room when thisPlayer makes a move
// takes in the board's index where thisPlayer makes the move 
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

    // check for sync success
    if (data) {
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

    // update the cells
    for (let i = 0; i < 9; i++) {
        cells[i].innerHTML = data.board[i];
    }

    // update winner display
    if (data.winner == '') {
        winnerDisplay.innerHTML = '';
        winner = '';
        
    } else if (data.winner == 'Tie') {
        winnerDisplay.innerHTML = 'Tie';
        winner = data.winner;

    } else {
        winnerDisplay.innerHTML = 'Winner: ' + data.winner;
        winner = data.winner;
    }

    // receive message from another player
    if (data.message != message && data.message != '') {
        historicalMessages.add(data.message);
        messageDisplay.innerHTML += '<div class="messageLine">' + data.message + '</div>';

        const { dataNoNeed, error } = await supabase.from("Game").update({ message: '' })
        .eq('room', currentRoom).select();

        message = '';
    }

    // update playersDisplay
    playerDisplay.innerHTML = (data.players[0] == '' ? 'empty' :  data.players[0]) + '(X)' + (thisPlayer == 'X' ? '(me)' : '') + ' vs ' + (data.players[1] == '' ? 'empty' :  data.players[1]) + '(O)' + (thisPlayer == 'O' ? '(me)' : '');

} // syncWithServer

// reset the room to the initial setup
async function resetGame() {
    // reset client variables
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    vote = ['', ''];
    message = '';
    winner = '';
    
    // reset winner display
    winnerDisplay.innerHTML = ''; 

    // reset input
    roomInput.value = '';

    const { data, error } = await supabase.from("Game").update({ board: board, currentPlayer: currentPlayer, winner: '', vote: ['', ''], message: '' })
        .eq('room', currentRoom).select();
 
} // resetGame

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
    historicalMessages = new Set();

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

    // reset player name if it is a default name
    if(thisPlayerName == "playerX" || thisPlayerName == "playerO"){
        thisPlayerName = '';
    }

    // reset room
    console.log('Exit from room ' + currentRoom);
    currentRoom = -1;

    // reset displays
    roomDisplay.innerHTML = "Room:";
    winnerDisplay.innerHTML = '';
    messageDisplay.innerHTML = '';
    playerDisplay.innerHTML = '';

    // reset input
    roomInput.value = '';

    setButtonStateOutsideRoom();
} // exitGame

function setButtonStateOutsideRoom(){

    // outside room:
    // activate init & join buttons
    // deactivate exit & reset & message buttons

    initButton.addEventListener('click', initGame);
    joinButton.addEventListener('click', joinRoom);
    initButton.style.backgroundColor = activatedButtonColor;
    joinButton.style.backgroundColor = activatedButtonColor;

    exitButton.removeEventListener('click', exitGame);
    resetButton.removeEventListener('click', resetGame);
    messageButton.removeEventListener('click', sendMessage);
    exitButton.style.backgroundColor = deactivatedButtonColor;
    resetButton.style.backgroundColor = deactivatedButtonColor;
    messageButton.style.backgroundColor = deactivatedButtonColor;
} // setButtonStateOutsideRoom

function setButtonStateInsideRoom(){

    // inside room:
    // activate exit & reset & message buttons
    // deactivate init & join buttons
    
    initButton.removeEventListener('click', initGame);
    joinButton.removeEventListener('click', joinRoom);
    initButton.style.backgroundColor = deactivatedButtonColor;
    joinButton.style.backgroundColor = deactivatedButtonColor;

    exitButton.addEventListener('click', exitGame);
    resetButton.addEventListener('click', resetGame);
    messageButton.addEventListener('click', sendMessage);
    exitButton.style.backgroundColor = activatedButtonColor;
    resetButton.style.backgroundColor = activatedButtonColor;
    messageButton.style.backgroundColor = activatedButtonColor;
} // setButtonStateInsideRoom

// update thisPlayerName
async function updateName(){

    // check for valid usernames
    if (roomInput.value == players[0] || roomInput.value == players[1] || roomInput.value == 'playerX' || roomInput.value == 'playerO') {
        
        alert('Duplicated / default names are not allowed. Please enter a new one.');

        // reset input
        roomInput.value = '';

        return
    }

    // change player name
    thisPlayerName = roomInput.value;

    // update server's players data
    if(currentRoom != -1){
        if(thisPlayer == "X"){
            players[0] = thisPlayerName;
        }else{
            players[1] = thisPlayerName;
        }

        const { data, error } = await supabase.from("Game").update({ players: players })
        .eq('room', currentRoom).select();

        await syncWithServer(currentRoom);
    }

    // reset input
    roomInput.value = '';
} // updateName

// send a message 
async function sendMessage() {
    if (currentRoom == -1) {
        alert("Can not send a message while you are not in a room.");
        return;
    }

    // get the message from roomInput and add thisPlayerName to its head
    message = thisPlayerName + ': ' + roomInput.value;

    // send message
    const { data, error } = await supabase.from("Game").update({ message:  message})
        .eq('room', currentRoom).select();

    // update message display
    historicalMessages.add(message);
    messageDisplay.innerHTML += '<div class="messageLine">' + message + '</div>';

    // reset input
    roomInput.value = '';
} // sendMessage