const boardElement = document.getElementById('chessboard');
const statusElement = document.getElementById('game-status');
const initialBoard = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

const pieceMap = {
    'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔', 'wP': '♙', // White pieces (hollow/light Unicode)
    'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚', 'bP': '♟'  // Black pieces (solid/dark Unicode)
};

let board = [];
let currentPlayer = 'white';
let selectedPiece = null; // { row, col, piece }
let possibleMoves = [];
let gameOver = false;

function getPieceColor(piece) {
    if (!piece) return null;
    return piece[0] === 'w' ? 'white' : 'black';
}

function getOpponentColor(color) {
    return color === 'white' ? 'black' : 'white';
}

function cloneBoard(boardState) {
    return boardState.map(row => [...row]);
}

function findKing(boardState, color) {
    const kingPiece = color === 'white' ? 'wK' : 'bK';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardState[r][c] === kingPiece) {
                return { r, c };
            }
        }
    }
    return null; // Should not happen in a valid game
}

function isKingInCheck(boardState, playerColor) {
    const kingPos = findKing(boardState, playerColor);
    if (!kingPos) return false;

    const opponentColor = getOpponentColor(playerColor);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (getPieceColor(piece) === opponentColor) {
                const moves = getTheoreticalPieceMoves(r, c, piece, boardState, true); // True to include king safety check
                for (const move of moves) {
                    if (move.row === kingPos.r && move.col === kingPos.c) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function getTheoreticalPieceMoves(r, c, piece, boardState, forCheckDetection = false) {
    const moves = [];
    const pieceType = piece[1];
    const pieceColor = getPieceColor(piece);
    const opponentColor = getOpponentColor(pieceColor);

    const checkAndAdd = (newR, newC) => {
        if (newR >= 0 && newR < 8 && newC >= 0 && newC < 8) {
            const targetPiece = boardState[newR][newC];
            // For kings, during check detection, we can't 'capture' the king itself.
            // But we need to know if the square is attacked.
            if (forCheckDetection) {
                // Any square occupied by an opponent's piece (including king) or empty is a potential target
                // for an attacking piece (except for pawn where target piece must be opponent for capture)
                if (pieceType === 'P') { // Pawns only attack diagonally
                     // This check is a bit redundant with the separate pawn capture logic below.
                     // But for general sliding pieces it means it can attack any square including king's.
                     if (targetPiece && getPieceColor(targetPiece) === opponentColor) {
                        return true; // Occupied by opponent, not empty. Stop sliding but record capture.
                     } else if (targetPiece === '') {
                        return true; // Empty square, can slide further.
                     } else if (getPieceColor(targetPiece) === pieceColor) {
                        return false; // Own piece, block.
                     }
                } else {
                    if (targetPiece && getPieceColor(targetPiece) === pieceColor) {
                        return false; // Own piece, blocks path for sliding pieces, cannot capture
                    }
                    moves.push({ row: newR, col: newC });
                    return !targetPiece; // If target piece exists, it's a capture, stop sliding
                }

            } else { // Normal move generation
                if (!targetPiece || getPieceColor(targetPiece) === opponentColor) {
                    moves.push({ row: newR, col: newC });
                }
                return !targetPiece; // If target piece exists, it's a capture, stop sliding
            }
        }
        return false; // Out of bounds
    };

    // Separate checkAndAdd for pawn captures only (different logic)
    const checkAndAddPawnCapture = (newR, newC) => {
        if (newR >= 0 && newR < 8 && newC >= 0 && newC < 8) {
            const targetPiece = boardState[newR][newC];
            if (targetPiece && getPieceColor(targetPiece) === opponentColor) {
                moves.push({ row: newR, col: newC });
                return true;
            }
        }
        return false;
    };

    switch (pieceType) {
        case 'P': // Pawn
            const direction = pieceColor === 'white' ? -1 : 1;
            // Forward 1
            if (r + direction >= 0 && r + direction < 8 && boardState[r + direction][c] === '') {
                moves.push({ row: r + direction, col: c });
                // Forward 2 (initial move)
                if (((pieceColor === 'white' && r === 6) || (pieceColor === 'black' && r === 1)) && boardState[r + 2 * direction][c] === '') {
                    moves.push({ row: r + 2 * direction, col: c });
                }
            }
            // Captures
            [-1, 1].forEach(colOffset => {
                checkAndAddPawnCapture(r + direction, c + colOffset);
            });
            break;
        case 'R': // Rook
            [ { dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 } ].forEach(({ dr, dc }) => {
                for (let i = 1; i < 8; i++) {
                    if (!checkAndAdd(r + dr * i, c + dc * i)) break;
                }
            });
            break;
        case 'N': // Knight
            [ { dr: 2, dc: 1 }, { dr: 2, dc: -1 }, { dr: -2, dc: 1 }, { dr: -2, dc: -1 },
              { dr: 1, dc: 2 }, { dr: 1, dc: -2 }, { dr: -1, dc: 2 }, { dr: -1, dc: -2 } ].forEach(({ dr, dc }) => checkAndAdd(r + dr, c + dc));
            break;
        case 'B': // Bishop
            [ { dr: 1, dc: 1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }, { dr: -1, dc: -1 } ].forEach(({ dr, dc }) => {
                for (let i = 1; i < 8; i++) {
                    if (!checkAndAdd(r + dr * i, c + dc * i)) break;
                }
            });
            break;
        case 'Q': // Queen
            [ { dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
              { dr: 1, dc: 1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }, { dr: -1, dc: -1 } ].forEach(({ dr, dc }) => {
                for (let i = 1; i < 8; i++) {
                    if (!checkAndAdd(r + dr * i, c + dc * i)) break;
                }
            });
            break;
        case 'K': // King
            [ { dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
              { dr: 1, dc: 1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }, { dr: -1, dc: -1 } ].forEach(({ dr, dc }) => checkAndAdd(r + dr, c + dc));
            break;
    }
    return moves;
}

function getLegalMoves(startR, startC, boardState, playerColor) {
    const theoreticalMoves = getTheoreticalPieceMoves(startR, startC, boardState[startR][startC], boardState);
    const legalMoves = [];

    for (const move of theoreticalMoves) {
        const simulatedBoard = cloneBoard(boardState);
        const pieceToMove = simulatedBoard[startR][startC];
        simulatedBoard[move.row][move.col] = pieceToMove;
        simulatedBoard[startR][startC] = '';

        if (!isKingInCheck(simulatedBoard, playerColor)) {
            legalMoves.push(move);
        }
    }
    return legalMoves;
}

function getAllLegalMovesForPlayer(boardState, playerColor) {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (getPieceColor(piece) === playerColor) {
                const moves = getLegalMoves(r, c, boardState, playerColor);
                moves.forEach(move => allMoves.push({ start: { r, c }, end: move }));
            }
        }
    }
    return allMoves;
}

function createBoardDOM() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = r;
            square.dataset.col = c;
            square.addEventListener('click', handleClick);
            boardElement.appendChild(square);
        }
    }
    updateBoardDisplay();
}

function updateBoardDisplay() {
    const squares = boardElement.children;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const squareIndex = r * 8 + c;
            const squareDiv = squares[squareIndex];
            const piece = board[r][c];

            squareDiv.innerHTML = ''; // Clear existing content
            if (piece) {
                const pieceSpan = document.createElement('span');
                pieceSpan.classList.add('piece', getPieceColor(piece));
                pieceSpan.textContent = pieceMap[piece];
                squareDiv.appendChild(pieceSpan);
            }

            squareDiv.className = ''; // Reset classes
            squareDiv.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');

            if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
                squareDiv.classList.add('selected');
            }
        }
    }
}

function highlightPossibleMoves(moves) {
    const squares = boardElement.children;
    for (const move of moves) {
        const squareIndex = move.row * 8 + move.col;
        squares[squareIndex].classList.add('possible-move');
    }
}

function clearHighlights() {
    const squares = boardElement.children;
    Array.from(squares).forEach(square => {
        square.classList.remove('selected', 'possible-move');
    });
}

function updateGameStatus(message) {
    statusElement.textContent = message;
}

function handleClick(event) {
    if (gameOver) return;

    const targetSquare = event.target.closest('.square');
    if (!targetSquare) return;

    const row = parseInt(targetSquare.dataset.row);
    const col = parseInt(targetSquare.dataset.col);
    const clickedPiece = board[row][col];
    const clickedPieceColor = getPieceColor(clickedPiece);

    if (selectedPiece) {
        // A piece is already selected, try to move
        const { row: startR, col: startC } = selectedPiece;

        const isValidTarget = possibleMoves.some(move => move.row === row && move.col === col);

        if (isValidTarget) {
            movePiece(startR, startC, row, col);
            selectedPiece = null;
            clearHighlights();
            updateBoardDisplay();
            switchPlayer(); // Switch player BEFORE checking for game over
            checkForGameOver(); // Check for game over for the *next* player
        } else {
            // Clicked an invalid square or own piece, deselect or reselect
            if (clickedPiece && clickedPieceColor === currentPlayer) {
                selectedPiece = { row, col, piece: clickedPiece };
                possibleMoves = getLegalMoves(row, col, board, currentPlayer);
                clearHighlights();
                updateBoardDisplay(); // To apply 'selected' class
                highlightPossibleMoves(possibleMoves);
            } else {
                selectedPiece = null;
                clearHighlights();
                updateBoardDisplay();
            }
        }
    } else {
        // No piece selected, try to select one
        if (clickedPiece && clickedPieceColor === currentPlayer) {
            selectedPiece = { row, col, piece: clickedPiece };
            possibleMoves = getLegalMoves(row, col, board, currentPlayer);
            updateBoardDisplay(); // To apply 'selected' class
            highlightPossibleMoves(possibleMoves);
        }
    }
}

function movePiece(startR, startC, endR, endC) {
    const piece = board[startR][startC];
    board[endR][endC] = piece;
    board[startR][startC] = '';

    // Pawn Promotion
    if (piece[1] === 'P' && ((getPieceColor(piece) === 'white' && endR === 0) || (getPieceColor(piece) === 'black' && endR === 7))) {
        board[endR][endC] = piece[0] + 'Q'; // Promote to Queen
        updateGameStatus(`${currentPlayer} pawn promoted to Queen!`);
    }
}

function switchPlayer() {
    currentPlayer = getOpponentColor(currentPlayer);
    let statusMsg = `${currentPlayer}'s turn`;
    if (isKingInCheck(board, currentPlayer)) {
        statusMsg = `${currentPlayer}'s turn. ${currentPlayer.toUpperCase()} KING IS IN CHECK!`;
    }
    updateGameStatus(statusMsg);
}

function checkForGameOver() {
    const allLegalMoves = getAllLegalMovesForPlayer(board, currentPlayer);

    if (allLegalMoves.length === 0) {
        if (isKingInCheck(board, currentPlayer)) {
            gameOver = true;
            updateGameStatus(`CHECKMATE! ${getOpponentColor(currentPlayer).toUpperCase()} wins!`);
        } else {
            gameOver = true;
            updateGameStatus("STALEMATE! It's a draw!");
        }
    }
}

function initializeGame() {
    board = initialBoard.map(row => [...row]); // Deep copy
    currentPlayer = 'white';
    selectedPiece = null;
    possibleMoves = [];
    gameOver = false;
    createBoardDOM();
    updateGameStatus(`${currentPlayer}'s turn`);
}

initializeGame();