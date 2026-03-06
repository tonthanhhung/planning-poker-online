// Matter.js module aliases
const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body, Vector } = Matter;

// Canvas setup
const canvas = document.getElementById('world');
const width = 800;
const height = 600;
canvas.width = width;
canvas.height = height;

// Create engine
const engine = Engine.create();
const world = engine.world;

// Create renderer
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: width,
        height: height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio
    }
});

// Game state
let balls = [];
let score = 0;

// Box dimensions
const boxX = 550;
const boxY = 400;
const boxWidth = 180;
const boxHeight = 150;
const wallThickness = 15;

// Create the box (open top, 3 walls)
function createBox() {
    const boxBottom = Bodies.rectangle(boxX, boxY + boxHeight/2, boxWidth, wallThickness, {
        isStatic: true,
        render: { fillStyle: '#e74c3c' },
        label: 'box'
    });

    const boxLeft = Bodies.rectangle(boxX - boxWidth/2, boxY, wallThickness, boxHeight, {
        isStatic: true,
        render: { fillStyle: '#e74c3c' },
        label: 'box'
    });

    const boxRight = Bodies.rectangle(boxX + boxWidth/2, boxY, wallThickness, boxHeight, {
        isStatic: true,
        render: { fillStyle: '#e74c3c' },
        label: 'box'
    });

    return [boxBottom, boxLeft, boxRight];
}

// Create walls around the canvas
function createWalls() {
    const wallOptions = {
        isStatic: true,
        render: { fillStyle: '#34495e' },
        label: 'wall'
    };

    const ground = Bodies.rectangle(width/2, height + 30, width, 60, wallOptions);
    const leftWall = Bodies.rectangle(-30, height/2, 60, height, wallOptions);
    const rightWall = Bodies.rectangle(width + 30, height/2, 60, height, wallOptions);
    const ceiling = Bodies.rectangle(width/2, -30, width, 60, wallOptions);

    return [ground, leftWall, rightWall, ceiling];
}

// Create a ball
function createBall(x, y) {
    const ball = Bodies.circle(x, y, 20, {
        restitution: 0.7,      // Bounciness (0-1)
        friction: 0.005,       // Surface friction
        frictionAir: 0.01,     // Air resistance
        density: 0.04,         // Mass
        render: {
            fillStyle: getRandomColor(),
            strokeStyle: '#fff',
            lineWidth: 2
        },
        label: 'ball'
    });

    return ball;
}

// Random color generator
function getRandomColor() {
    const colors = ['#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e91e63', '#ff5722'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Spawn ball at throw position
function spawnBall() {
    const ball = createBall(150, 200);
    balls.push(ball);
    Composite.add(world, ball);
    updateStats();
}

// Clear all balls
function clearBalls() {
    balls.forEach(ball => Composite.remove(world, ball));
    balls = [];
    score = 0;
    updateStats();
}

// Reset entire scene
function resetScene() {
    clearBalls();
    spawnBall();
}

// Update stats display
function updateStats() {
    document.getElementById('total').textContent = balls.length;
    document.getElementById('score').textContent = score;
}

// Check if ball is in box
function isBallInBox(ball) {
    const ballX = ball.position.x;
    const ballY = ball.position.y;

    return (
        ballX > boxX - boxWidth/2 + 20 &&
        ballX < boxX + boxWidth/2 - 20 &&
        ballY > boxY - boxHeight/2 + 20 &&
        ballY < boxY + boxHeight/2
    );
}

// Collision detection for scoring
Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;

    pairs.forEach(pair => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Check ball hitting box
        if ((bodyA.label === 'ball' && bodyB.label === 'box') ||
            (bodyB.label === 'ball' && bodyA.label === 'box')) {
            const ball = bodyA.label === 'ball' ? bodyA : bodyB;

            // Visual feedback - flash the ball
            const originalColor = ball.render.fillStyle;
            ball.render.fillStyle = '#fff';
            setTimeout(() => {
                ball.render.fillStyle = originalColor;
            }, 100);
        }
    });
});

// Track balls in box
Events.on(engine, 'beforeUpdate', () => {
    let currentScore = 0;
    balls.forEach(ball => {
        if (isBallInBox(ball)) {
            currentScore++;
        }
    });

    if (currentScore !== score) {
        score = currentScore;
        updateStats();
    }
});

// Add mouse control for throwing
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: true,
            strokeStyle: '#fff',
            lineWidth: 2
        }
    }
});

// Only allow dragging balls
Events.on(mouseConstraint, 'startdrag', (event) => {
    if (event.body.label !== 'ball') {
        mouseConstraint.body = null;
    }
});

// Add everything to world
Composite.add(world, [...createWalls(), ...createBox(), mouseConstraint]);

// Keep the mouse in sync with rendering
render.mouse = mouse;

// Run the engine
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Initial ball
spawnBall();

// Visual indicator for throw zone
const ctx = canvas.getContext('2d');
Events.on(render, 'afterRender', () => {
    // Draw throw zone indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(150, 200, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(150, 200, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DRAG & THROW', 150, 205);

    // Draw box label
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('TARGET BOX', boxX, boxY - boxHeight/2 - 10);
});

// Handle window resize
window.addEventListener('resize', () => {
    render.canvas.width = width;
    render.canvas.height = height;
});
