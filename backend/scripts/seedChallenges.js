import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Challenge from '../models/Challenge.js';

dotenv.config();

const challenges = [
  {
    prompt: "Sestavi preprosti električni krog z baterijo in svetilko.",
    requiredComponents: [
      "baterija",
      "svetilka",
      "žica",
      "žica",
      "žica",
      "žica",
      "žica",
      "žica",
    ],
    theory: [
      "Osnovni električni krog potrebuje vir, to je v našem primeru baterija. Potrebuje tudi porabnike, to je svetilka. Električni krog je v našem primeru sklenjen, kar je nujno potrebno, da električni tok teče preko prevodnikov oziroma žic.",
    ],
    order: 0,
    difficulty: "easy",
    points: 100
  },
  {
    prompt: "Sestavi preprosti nesklenjeni električni krog z baterijo, svetilko in stikalom.",
    requiredComponents: ["baterija", "svetilka", "žica", "stikalo"],
    theory: [
      "V nesklenjenem krogu je stikalo odprto, kar pomeni, da je električni tok prekinjen. Svetilka posledično zato ne sveti.",
    ],
    order: 1,
    difficulty: "easy",
    points: 150
  },
  {
    prompt: "Sestavi preprosti sklenjeni električni krog z baterijo, svetilko in stikalom.",
    requiredComponents: ["baterija", "svetilka", "žica", "stikalo"],
    theory: [
      "V sklenjenem krogu je stikalo zaprto, kar pomeni, da lahko električni tok teče neovirano. Torej v tem primeru so vrata zaprta.",
    ],
    order: 2,
    difficulty: "easy",
    points: 150
  },
  {
    prompt: "Sestavi električni krog z baterijo, svetilko in stikalom, ki ga lahko ugašaš in prižigaš.",
    requiredComponents: [
      "baterija",
      "svetilka",
      "žica",
      "stikalo",
    ],
    theory: [
      "Stikalo nam omogoča nadzor nad pretokom električnega toka. Ko je stikalo zaprto, tok teče in posledično svetilka sveti. Kadar pa je stikalo odprto, tok ne teče in se svetilka ugasne. To lahko primerjamo z vklapljanjem in izklapljanjem električnih naprav v naših domovih.",
    ],
    order: 3,
    difficulty: "medium",
    points: 200
  },
  {
    prompt: "Sestavi krog z dvema baterijama in svetilko.",
    requiredComponents: ["baterija", "baterija", "svetilka", "žica"],
    theory: [
      "Kadar vežemo dve ali več baterij zaporedno, se napetosti seštevajo. Večja je napetost, večji je električni tok. V našem primeru zato svetilka sveti močneje.",
    ],
    order: 4,
    difficulty: "medium",
    points: 200
  },
  {
    prompt: "V električni krog zaporedno poveži dve svetilki, ki ju priključiš na baterijo.",
    requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
    theory: [
      "V zaporedni vezavi teče isti električni tok skozi vse svetilke. Napetost baterije se porazdeli. Če imamo primer, da ena svetilka preneha delovati, bo ta prekinila tok skozi drugo svetilko.",
    ],
    order: 5,
    difficulty: "medium",
    points: 250
  },
  {
    prompt: "V električni krog vzporedno poveži dve svetilki, ki ju priključiš na baterijo.",
    requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
    theory: [
      "V vzporedni vezavi ima vsaka svetilka enako napetost kot baterija. Eletrični tok se porazdeli med svetilkami. Če ena svetilka preneha delovati, bo druga še vedno delovala.",
    ],
    order: 6,
    difficulty: "hard",
    points: 300
  },
  {
    prompt: "Sestavi električni krog s svetilko in uporom.",
    requiredComponents: ["baterija", "svetilka", "žica", "upor"],
    theory: [
      "Upor omejuje tok v krogu. Večji kot je upor, manjši je tok. Spoznajmo Ohmov zakon: tok (I) = napetost (U) / upornost (R). Svetilka bo svetila manj intenzivno, saj skozi njo teče manjši tok.",
    ],
    order: 7,
    difficulty: "hard",
    points: 300
  },
];

const seedChallenges = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    await Challenge.deleteMany({});
    console.log('Cleared existing challenges');

    await Challenge.insertMany(challenges);
    console.log('Challenges seeded successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding challenges:', error);
    process.exit(1);
  }
};

seedChallenges();
