import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MongoDB connection
const MONGO_URI = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.bdvtj.mongodb.net/${process.env.MONGO_DB_NAME}?retryWrites=true&w=majority`;
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema
const TeamSchema = new mongoose.Schema({
    name: String,
    mascot: String,
    city: String,
    players: [{ firstName: String, lastName: String, age: Number, height: String }],
});

const Team = mongoose.model('Team', TeamSchema);

// Middleware
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    res.render('index');
});

// Load a team
app.get('/loadTeam', async (req, res) => {
    try {
        const response = await fetch('https://api-nba-v1.p.rapidapi.com/teams', {
            method: 'GET',
            headers: {
                'x-rapidapi-key': process.env.API_NBA_KEY,
                'x-rapidapi-host': 'api-nba-v1.p.rapidapi.com'
            }
        });

        const data = await response.json();

        // Filter NBA teams only
        const teams = data.response.filter(team => team.nbaFranchise);

        if (!teams || teams.length === 0) {
            return res.send(
                `<script>alert('No teams available to load. Please try again later.'); window.location.href='/';</script>`
            );
        }

        // Pass teams to the template
        res.render('loadTeam', { teams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).send('An error occurred while fetching teams.');
    }
});

app.post('/loadTeam', async (req, res) => {
    const { selectedTeam } = req.body;
    try {
        const response = await fetch(`https://api-nba-v1.p.rapidapi.com/teams?name=${selectedTeam}`, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': process.env.API_NBA_KEY,
                'x-rapidapi-host': 'api-nba-v1.p.rapidapi.com',
            },
        });
        const data = await response.json();
        const team = data.response[0];
        if (!team) {
            return res.send(`<script>alert('Invalid Team!'); window.location.href='/loadTeam';</script>`);
        }

        const newTeam = new Team({
            name: team.name,
            mascot: team.nickname,
            city: team.city,
        });

        await newTeam.save();
        res.send(`<script>alert('Team ${team.name} loaded successfully!'); window.location.href='/';</script>`);
    } catch (error) {
        console.error('Error loading team:', error);
        res.status(500).send('Error loading team.');
    }
});

// Add Player route
app.get('/addPlayer', async (req, res) => {
    try {
        const teams = await Team.find({});
        res.render('addPlayer', { teams });
    } catch (error) {
        console.error('Error fetching teams for Add Player page:', error);
        res.status(500).send('Error loading Add Player page.');
    }
});

app.post('/addPlayer', async (req, res) => {
    const { teamName, firstName, lastName, age, height } = req.body;

    try {
        // Find the team in MongoDB by name
        const team = await Team.findOne({ name: teamName.trim() });
        if (!team) {
            return res.send(
                "<script>alert('Team not found! Please load the team first.'); window.location.href = '/searchRoster';</script>"
            );
        }

        if (!team) {
            console.log('Team not found in the database:', teamName);
            return res.send(
                `<script>alert('Team not found. Please select a valid team.'); window.location.href='/addPlayer';</script>`
            );
        }

        // Add the player to the team's players array
        const newPlayer = { firstName, lastName, age, height };
        team.players.push(newPlayer);

        // Save the updated team back to MongoDB
        await team.save();

        res.send(
            `<script>alert('Player ${firstName} ${lastName} added to ${team.name}!'); window.location.href='/';</script>`
        );
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).send('An error occurred while adding the player.');
    }
});

// Team Roster Page
app.post('/teamRoster', async (req, res) => {
    const { teamName } = req.body;

    try {
        // Fetch the team by name
        const team = await Team.findOne({ name: teamName });

        if (!team) {
            return res.send(
                `<script>alert('Team not found. Please select a valid team.'); window.location.href='/searchRoster';</script>`
            );
        }

        // Pass the team and its players to the template
        res.render('teamRoster', { team, players: team.players || [] });
    } catch (error) {
        console.error('Error fetching team roster:', error);
        res.status(500).send('An error occurred while fetching the team roster.');
    }
});

// Search Roster route
app.get('/searchRoster', async (req, res) => {
    try {
        // Fetch all loaded teams from MongoDB
        const teams = await Team.find({});

        if (!teams || teams.length === 0) {
            return res.send(
                `<script>alert('No teams have been loaded. Please load a team first.'); window.location.href='/';</script>`
            );
        }

        // Pass teams to the template
        res.render('searchRoster', { teams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).send('An error occurred while fetching teams.');
    }
});

app.post('/searchRoster', async (req, res) => {
    const { teamName } = req.body;
    try {
        const team = await Team.findOne({ name: teamName });
        if (!team) {
            return res.send(`<script>alert('Team not found. Please select a valid team.'); window.location.href='/searchRoster';</script>`);
        }
        res.render('teamRoster', { team });
    } catch (error) {
        console.error('Error fetching roster:', error);
        res.status(500).send('Error fetching roster.');
    }
});

// Search Player route
app.get('/searchPlayer', async (req, res) => {
    try {
        const teams = await Team.find({});
        res.render('searchPlayer', { teams });
    } catch (error) {
        console.error('Error loading Search Player page:', error);
        res.status(500).send('Error loading Search Player page.');
    }
});

app.post('/searchPlayer', async (req, res) => {
    const { firstName, lastName } = req.body;

    try {
        // Build the query object dynamically based on input
        const query = {};
        if (firstName) query['players.firstName'] = { $regex: new RegExp(firstName, 'i') };
        if (lastName) query['players.lastName'] = { $regex: new RegExp(lastName, 'i') };

        // Search for players in MongoDB
        const teams = await Team.find(query, { 'players.$': 1, name: 1, city: 1, mascot: 1 });

        if (teams.length === 0) {
            return res.send(
                `<script>alert('Player not found!'); window.location.href = '/searchPlayer';</script>`
            );
        }

        // Prepare results to send to the playerDetails.ejs
        const players = teams.flatMap(team =>
            team.players.map(player => ({
                firstName: player.firstName,
                lastName: player.lastName,
                age: player.age,
                height: player.height,
                teamName: team.name,
                teamCity: team.city,
                teamMascot: team.mascot,
            }))
        );

        res.render('playerDetails', { players });
    } catch (error) {
        console.error('Error searching for player:', error);
        res.status(500).send('Error occurred while searching for player.');
    }
});

// Include Remove Players functionality
app.get('/removePlayers', (req, res) => {
    res.render('removePlayers');
});

app.post('/removePlayers', async (req, res) => {
    try {
        await Team.updateMany({}, { $set: { players: [] } });
        res.render('removeSuccess');
    } catch (error) {
        console.error('Error removing players:', error);
        res.status(500).send('Error removing players.');
    }
});

// Remove all teams
app.get('/removeTeams', (req, res) => {
    res.render('removeTeams');
});

app.post('/removeTeams', async (req, res) => {
    try {
        await Team.deleteMany({});
        res.render('removeSuccess');
    } catch (error) {
        console.error('Error removing teams:', error);
        res.status(500).send('Error removing teams.');
    }
});

// Stop server gracefully
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.on('line', input => {
    if (input.trim() === 'stop') {
        mongoose.connection.close().then(() => {
            console.log('Server stopped.');
            process.exit(0);
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
