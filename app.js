require( "dotenv" ).config();

const fetch = require( "node-fetch" );
const crypto = require( "crypto" );
const fs = require( "fs" );
const express = require( "express" );
const { Sequelize, Model, DataTypes } = require( "sequelize" );

const app = express();
const port = process.env.PORT || 3000;
const sequelize = new Sequelize( {
		dialect: "postgres",
		username: process.env.COCKROACHDB_USER,
		password: process.env.COCKROACHDB_PASS,
		host: process.env.COCKROACHDB_HOST,
		port: 26257,
		database: process.env.COCKROACHDB_DATABASE,
		dialectOptions: {
			ssl: {
				ca: fs.readFileSync( "cc-ca.crt" ).toString()
			},
		},
		logging: false
} );

class Character extends Model {}
Character.init({
    marvelId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    thumbnail: DataTypes.STRING,
    blip: DataTypes.BOOLEAN
}, { sequelize, modelName: 'character' });

const blipped = [
	"Andre Wilson",
	"Asgardian Actor",
	"Betty Brant",
	"Betty Ross",
	"Big Harv",
	"Billy Peskers",
	"Bucky Barnes",
	"Cammie Conroy",
	"Cooper Barton",
	"David Jerome",
	"Drax",
	"Elijah Cortez",
	"Erik Selvig",
	"Erika Denton",
	"Flash Thompson",
	"Galaga Guy",
	"Groot",
	"Hank Pym",
	"Hope van Dyne",
	"Hiro Kajimoto",
	"Isaiah Sorenson",
	"Jane Foster",
	"Janet van Dyne",
	"Jason Ionello",
	"Karen Oggerton",
	"Laura Barton",
	"Lila Barton",
	"Mantis",
	"Maria Hill",
	"Mary Livanos",
	"May Parker",
	"Michelle Jones",
	"Nathaniel Barton",
	"Ned Leeds",
	"Nick Fury",
	"Peter Parker",
	"Peter Quill",
	"Phillip Carroway",
	"Sam Wilson",
	"Sharon Carter",
	"Shuri",
	"Sif",
	"Stephen Strange",
	"Sue Lorman",
	"T'Challa",
	"Thaddeus Ross",
	"Wanda Maximoff",
	"Wong"
];

const notBlipped = [
"Tony Stark",
"Thor",
"Bruce Banner",
"Steve Rogers",
"Natasha Romanoff",
"James Rhodes",
"Nebula",
"Okoye",
"Rocket Raccoon",
"Pepper Potts",
"Thanos",
"M'Baku",
"Happy Hogan",
"Clint Barton",
"Scott Lang",
"Carol Danvers",
"Brunnhilde",
"Korg",
"Miek",
"Akihiko",
"Cassie Lang",
"Howard the Duck",
"Brooklyn Support Group Bobby",
"Brooklyn Support Group Jimmy",
"Brad Davis",
"Roger Harrington",
"Zach Cooper",
"Zoha",
"Yasmin Monette",
"Tyler Corbyn",
"Sebastian",
"Phil Coulson",
"Melinda May",
"Daisy Johnson",
"Leo Fitz",
"Jemma Simmons",
"Alphonso Mackenzie",
"Yo-Yo Rodriguez",
"Deke Shaw",
"Enoch",
"Agent Davis",
"Agent Piper",
"Agent Julian",
"Agent Damon Keller",
"Agent Diaz",
"Jaco",
"Marcus Benson",
"Pax",
"Snowflake",
"Malachi",
"Boyle",
"Toad",
"Trevor Khan",
"Atarah",
"Sarge",
"Izel",
"Isaiah",
"Baal-Gad",
"Alex Wilder",
"Nico Minoru",
"Karolina Dean",
"Gert Yorkes",
"Chase Stein",
"Molly Hernandez",
"Geoffrey Wilder",
"Leslie Dean",
"Janet Stein",
"Victor Stein",
"Stacey Yorkes",
"Dale Yorkes",
"Tina Minoru",
"Robert Minoru",
"Morgan le Fay",
"Tamar",
"Vaughn Kaye",
"Bronwyn",
"Cassandra",
"Tandy Bowen",
"Tyrone Johnson",
"Old Lace"
];

// Get character data using the Marvel API
async function getCharacters( offset = 0 ) {
	const baseUrl = "https://gateway.marvel.com";
	const ts = new Date().getTime();
	// Generate MD5 hash
	const hash = crypto.createHash( "md5" ).update(`${ts}${process.env.MARVEL_PRIVATE_KEY}${process.env.MARVEL_PUBLIC_KEY}`).digest("hex" );

	let result = await fetch(
	`${baseUrl}/v1/public/characters?ts=${ts}&hash=${hash}&apikey=${process.env.MARVEL_PUBLIC_KEY}&limit=100&offset=${offset}`)
		.then( r => r.json() );

	 return result;
}

app.set( "view engine", "pug" );

app.get( "/", async ( req, res ) => {
	// -- Get All Characters --
	const characters = await Character.findAll();

	res.render( "index", { title: "The Blip (All Characters)", characters } );
});

app.get( "/sync", async ( req, res ) => {
	// -- Retrieve and Insert Characters Data --
	let result = await getCharacters( 0 ); // Retrieve once to get the total
	const total = result.data.total;

	// Clear the table
	await Character.destroy({
			truncate: true
	});

	let batch = [];

	for( let offset = 0; offset < total; offset += 100 ) {
			// Get Character Data
			result = await getCharacters( offset );

			//TODO: remove
			console.log(result);

			const characters = result.data.results;
			// Bulk Create
			for( let i = 0; i < characters.length; i++ ) {
					const isBlipped = blipped.some( c => characters[ i ].name.includes( c ));
					const isSafe = notBlipped.some( c => characters[ i ].name.includes( c ));

					batch.push({
							marvelId: characters[ i ].id,
							name: characters[ i ].name,
							thumbnail: `${characters[ i ].thumbnail[ "path" ]}.${characters[ i
].thumbnail[ "extension" ]}`,
							blip: isBlipped ? true : ( isSafe ? false : null )
					});
			}
	}

	const c = await Character.bulkCreate( batch );

	res.json( { success: true } );
});

app.get( "/all", async ( req, res ) => {
	// -- Get All Characters --
	const characters = await Character.findAll();

	res.render( "index", { title: "The Blip (All Characters)", characters: characters } );
});

app.get( "/blipped", async ( req, res ) => {
	// -- Get Blipped Characters --
	const characters = await Character.findAll({
			where: {
					blip: true
			}
	});

	res.render( "index", { title: "The Blip (Blipped)", characters: characters } );
});

app.get( "/safe", async ( req, res ) => {
	// -- Get Non-Blipped Characters --
	const characters = await Character.findAll({
			where: {
					blip: false
			}
	});

	res.render( "index", { title: "The Blip (Safe)", characters: characters } );
});

app.get( "/unknown", async ( req, res ) => {
	// -- Get Non-Blipped Characters --
	const characters = await Character.findAll({
			where: {
					blip: null
			}
	});

	res.render( "index", { title: "The Blip (Unknown)", characters: characters } );
});

app.get( "/blip/:id", async ( req, res ) => {
	// -- Blip Character by ID --
	const character = await Character.update( { blip: true }, {
			where: {
					marvelId: req.params[ "id" ]
			}
	});

	res.json( character );
});

app.get( "/unblip/:id", async ( req, res ) => {
	// -- Unblip Character by ID --
	const character = await Character.update( { blip: false }, {
			where: {
					marvelId: req.params[ "id" ]
			}
	});
	res.json( character );
});

app.listen( port, () => {
    console.log( `App listening at http://localhost:${port}` );
		sequelize.sync(); // Synchronize our DB
});
