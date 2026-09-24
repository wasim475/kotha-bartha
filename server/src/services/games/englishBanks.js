// Question banks for the English games. They live ONLY on the server: a
// question's correct answer is never sent to a client until that question
// has been answered (see game.service.js). A fresh random sample of 10 is
// drawn per attempt and each drawn question gets its own option shuffle
// (see questionBuilder.generateFromBank), so the order here is irrelevant
// and nothing in this file is ever mutated.
//
// Item shape — the correct answer is stored separately from the three
// distractors, so option order is decided per attempt, never authored:
//
//   { prompt, answer, wrong: [three distinct wrong options] }
//
// Rules every item follows (checked by the bank validator test):
//   - exactly four distinct options in total, `answer` not among `wrong`
//   - exactly ONE option is correct — no distractor is also a valid answer
//   - beginner-friendly, age-appropriate vocabulary and sentences

const meaning = (word, answer, wrong) => ({ prompt: `"${word}" means—`, answer, wrong });
const synonym = (word, answer, wrong) => ({ prompt: `Choose the synonym of "${word}":`, answer, wrong });
const antonym = (word, answer, wrong) => ({ prompt: `Choose the antonym of "${word}":`, answer, wrong });
const kindOf = (word, answer, wrong) => ({ prompt: `"${word}" is a—`, answer, wrong });

const englishWordBank = [
  // ---------- Word meaning (English → Bengali) ----------
  meaning("Brave", "সাহসী", ["ভীত", "অলস", "দুর্বল"]),
  meaning("Happy", "খুশি", ["দুঃখী", "রাগান্বিত", "ক্লান্ত"]),
  meaning("Teacher", "শিক্ষক", ["ডাক্তার", "কৃষক", "জেলে"]),
  meaning("Book", "বই", ["কলম", "চেয়ার", "জানালা"]),
  meaning("Water", "পানি", ["আগুন", "বাতাস", "মাটি"]),
  meaning("Friend", "বন্ধু", ["শত্রু", "প্রতিবেশী", "অতিথি"]),
  meaning("House", "বাড়ি", ["গাড়ি", "নদী", "গাছ"]),
  meaning("River", "নদী", ["পাহাড়", "মাঠ", "আকাশ"]),
  meaning("Sun", "সূর্য", ["চাঁদ", "তারা", "মেঘ"]),
  meaning("Moon", "চাঁদ", ["সূর্য", "তারা", "বৃষ্টি"]),
  meaning("Fast", "দ্রুত", ["ধীর", "ভারী", "নরম"]),
  meaning("Slow", "ধীর", ["দ্রুত", "উঁচু", "গরম"]),
  meaning("Hungry", "ক্ষুধার্ত", ["ঘুমন্ত", "রাগী", "সুখী"]),
  meaning("Honest", "সৎ", ["মিথ্যাবাদী", "অলস", "লোভী"]),
  meaning("Kind", "দয়ালু", ["নিষ্ঠুর", "রাগী", "ভীতু"]),
  meaning("Clever", "বুদ্ধিমান", ["বোকা", "অলস", "দুর্বল"]),
  meaning("Village", "গ্রাম", ["শহর", "বন", "সমুদ্র"]),
  meaning("Market", "বাজার", ["স্কুল", "হাসপাতাল", "মসজিদ"]),
  meaning("Doctor", "ডাক্তার", ["শিক্ষক", "কৃষক", "চালক"]),
  meaning("Farmer", "কৃষক", ["জেলে", "ডাক্তার", "দর্জি"]),
  meaning("Angry", "রাগান্বিত", ["খুশি", "ক্লান্ত", "ভীত"]),
  meaning("Tired", "ক্লান্ত", ["সতেজ", "খুশি", "বুদ্ধিমান"]),
  meaning("Cold", "ঠান্ডা", ["গরম", "নরম", "ভারী"]),
  meaning("Beautiful", "সুন্দর", ["কুৎসিত", "দুর্বল", "ভারী"]),

  // ---------- Synonyms ----------
  synonym("Happy", "Glad", ["Sad", "Angry", "Weak"]),
  synonym("Big", "Large", ["Small", "Thin", "Short"]),
  synonym("Small", "Tiny", ["Huge", "Tall", "Heavy"]),
  synonym("Quick", "Fast", ["Slow", "Late", "Weak"]),
  synonym("Smart", "Clever", ["Foolish", "Lazy", "Rude"]),
  synonym("Begin", "Start", ["End", "Stop", "Finish"]),
  synonym("Buy", "Purchase", ["Sell", "Lose", "Break"]),
  synonym("Angry", "Mad", ["Calm", "Happy", "Tired"]),
  synonym("Sick", "Ill", ["Well", "Strong", "Rich"]),
  synonym("Kid", "Child", ["Adult", "Parent", "Teacher"]),
  synonym("Rich", "Wealthy", ["Poor", "Weak", "Lazy"]),
  synonym("Shut", "Close", ["Open", "Break", "Begin"]),
  synonym("Simple", "Easy", ["Hard", "Heavy", "Rough"]),
  synonym("Cry", "Weep", ["Laugh", "Shout", "Sleep"]),
  synonym("Beautiful", "Pretty", ["Ugly", "Weak", "Bitter"]),
  synonym("Brave", "Bold", ["Afraid", "Weak", "Lazy"]),
  synonym("Correct", "Right", ["Wrong", "False", "Bad"]),
  synonym("Silent", "Quiet", ["Loud", "Noisy", "Rough"]),
  synonym("Finish", "Complete", ["Start", "Begin", "Lose"]),
  synonym("Gift", "Present", ["Debt", "Trouble", "Danger"]),

  // ---------- Antonyms ----------
  antonym("Big", "Small", ["Large", "Huge", "Tall"]),
  antonym("Hot", "Cold", ["Warm", "Boiling", "Bright"]),
  antonym("Up", "Down", ["Over", "Above", "High"]),
  antonym("Day", "Night", ["Morning", "Noon", "Evening"]),
  antonym("Happy", "Sad", ["Glad", "Merry", "Joyful"]),
  antonym("Rich", "Poor", ["Wealthy", "Kind", "Strong"]),
  antonym("Fast", "Slow", ["Quick", "Rapid", "Speedy"]),
  antonym("Strong", "Weak", ["Mighty", "Brave", "Tall"]),
  antonym("Early", "Late", ["Soon", "First", "Quick"]),
  antonym("Open", "Close", ["Start", "Begin", "Wide"]),
  antonym("Love", "Hate", ["Like", "Care", "Adore"]),
  antonym("Friend", "Enemy", ["Neighbour", "Partner", "Helper"]),
  antonym("Empty", "Full", ["Vacant", "Hollow", "Bare"]),
  antonym("Clean", "Dirty", ["Neat", "Fresh", "Tidy"]),
  antonym("Correct", "Wrong", ["Right", "True", "Exact"]),
  antonym("Buy", "Sell", ["Pay", "Bring", "Send"]),
  antonym("Old", "Young", ["Ancient", "Aged", "Elderly"]),
  antonym("Tall", "Short", ["High", "Long", "Big"]),
  antonym("Win", "Lose", ["Play", "Try", "Get"]),
  antonym("Wet", "Dry", ["Damp", "Soaked", "Cold"]),

  // ---------- Basic vocabulary ----------
  kindOf("Apple", "Fruit", ["Animal", "Vehicle", "Building"]),
  kindOf("Dog", "Animal", ["Fruit", "Vehicle", "Furniture"]),
  kindOf("Car", "Vehicle", ["Fruit", "Animal", "Colour"]),
  kindOf("Rose", "Flower", ["Fruit", "Animal", "Vehicle"]),
  kindOf("Table", "Furniture", ["Fruit", "Bird", "Vehicle"]),
  kindOf("Sparrow", "Bird", ["Fish", "Vegetable", "Vehicle"]),
  kindOf("Carrot", "Vegetable", ["Animal", "Building", "Colour"]),
  kindOf("Red", "Colour", ["Fruit", "Animal", "Day"]),
  kindOf("Monday", "Day", ["Month", "Colour", "Animal"]),
  kindOf("January", "Month", ["Day", "Fruit", "Vehicle"]),
  kindOf("Hospital", "Building", ["Fruit", "Animal", "Colour"]),
  kindOf("Bus", "Vehicle", ["Bird", "Fruit", "Flower"]),
  kindOf("Mango", "Fruit", ["Animal", "Vehicle", "Building"]),
  kindOf("Hilsa", "Fish", ["Bird", "Flower", "Vehicle"]),
  kindOf("Eye", "Body part", ["Fruit", "Colour", "Animal"]),
  kindOf("Chair", "Furniture", ["Animal", "Fruit", "Colour"]),
  kindOf("Tiger", "Animal", ["Fruit", "Vehicle", "Building"]),
  kindOf("Potato", "Vegetable", ["Animal", "Colour", "Building"]),
  kindOf("Boat", "Vehicle", ["Animal", "Fruit", "Flower"]),
  kindOf("School", "Building", ["Fruit", "Animal", "Colour"]),
  kindOf("Blue", "Colour", ["Fruit", "Animal", "Vehicle"]),
  kindOf("Eagle", "Bird", ["Fish", "Vegetable", "Furniture"]),
  kindOf("Milk", "Drink", ["Animal", "Furniture", "Vehicle"]),
  kindOf("Pen", "Writing tool", ["Animal", "Vehicle", "Fruit"]),
];

// ---------- Bengali → English conversion ----------
// Beginner sentences. Every wrong option is a plainly wrong rendering
// (wrong tense, subject–verb agreement, missing article, wrong meaning) so
// there is only ever one acceptable English sentence among the four.
const conversion = (bengali, answer, wrong) => ({
  prompt: `"${bengali}" এর ইংরেজি কোনটি?`,
  answer,
  wrong,
});

const englishConversionBank = [
  conversion("আমি স্কুলে যাই।", "I go to school.", ["I went to school.", "I am going school.", "I goes to school."]),
  conversion("সে একজন ছাত্র।", "He is a student.", ["He are a student.", "He is student.", "He was student."]),
  conversion("আমার একটি বই আছে।", "I have a book.", ["I has a book.", "I am have a book.", "I had book."]),
  conversion("সে ভাত খায়।", "He eats rice.", ["He eat rice.", "He eating rice.", "He is eat rice."]),
  conversion("আমরা ফুটবল খেলি।", "We play football.", ["We plays football.", "We are play football.", "We playing football."]),
  conversion("তুমি কোথায় থাকো?", "Where do you live?", ["Where you live?", "Where does you live?", "Where are you live?"]),
  conversion("এটি একটি কলম।", "This is a pen.", ["This are a pen.", "This is pen.", "These is a pen."]),
  conversion("ওরা আমার বন্ধু।", "They are my friends.", ["They is my friends.", "They are my friend.", "They am my friends."]),
  conversion("আমি প্রতিদিন সকালে হাঁটি।", "I walk every morning.", ["I walks every morning.", "I am walk every morning.", "I walking every morning."]),
  conversion("সে গতকাল স্কুলে গিয়েছিল।", "He went to school yesterday.", ["He goes to school yesterday.", "He go to school yesterday.", "He is going to school yesterday."]),
  conversion("আমি একটি আম খাচ্ছি।", "I am eating a mango.", ["I eating a mango.", "I am eat a mango.", "I eats a mango."]),
  conversion("তোমার নাম কী?", "What is your name?", ["What your name?", "Which is your name?", "What are your name?"]),
  conversion("আজ আকাশ পরিষ্কার।", "The sky is clear today.", ["The sky are clear today.", "The sky clear today.", "The sky is clearly today."]),
  conversion("আমরা কাল ঢাকায় যাব।", "We will go to Dhaka tomorrow.", ["We will went to Dhaka tomorrow.", "We goes to Dhaka tomorrow.", "We are went to Dhaka tomorrow."]),
  conversion("সে আমাকে সাহায্য করে।", "He helps me.", ["He help me.", "He helping me.", "He helps I."]),
  conversion("আমার মা একজন শিক্ষিকা।", "My mother is a teacher.", ["My mother are a teacher.", "My mother is teacher.", "My mother be a teacher."]),
  conversion("কুকুরটি দৌড়াচ্ছে।", "The dog is running.", ["The dog running.", "The dog are running.", "The dog is run."]),
  conversion("আমি দুধ পান করি না।", "I do not drink milk.", ["I not drink milk.", "I does not drink milk.", "I am not drink milk."]),
  conversion("তারা মাঠে খেলছে।", "They are playing in the field.", ["They is playing in the field.", "They playing in the field.", "They are play in the field."]),
  conversion("তুমি কেমন আছো?", "How are you?", ["How is you?", "How you are?", "How do you?"]),
  conversion("আমি বাংলা বলতে পারি।", "I can speak Bangla.", ["I can speaks Bangla.", "I can to speak Bangla.", "I can speaking Bangla."]),
  conversion("সে প্রতিদিন স্কুলে আসে।", "He comes to school every day.", ["He come to school every day.", "He coming to school every day.", "He is come to school every day."]),
  conversion("আমার একজন ভাই আছে।", "I have a brother.", ["I has a brother.", "I have brother.", "I am have a brother."]),
  conversion("বইটি টেবিলের উপর আছে।", "The book is on the table.", ["The book is under the table.", "The book are on the table.", "The book is on table."]),
  conversion("আমি ক্ষুধার্ত।", "I am hungry.", ["I is hungry.", "I hungry.", "I are hungry."]),
  conversion("তারা গান গাইছে।", "They are singing a song.", ["They is singing a song.", "They singing a song.", "They are sing a song."]),
  conversion("আমরা বিদ্যালয়ে পড়ি।", "We study at school.", ["We studies at school.", "We are study at school.", "We studying at school."]),
  conversion("সে একটি চিঠি লিখছে।", "She is writing a letter.", ["She writing a letter.", "She is write a letter.", "She are writing a letter."]),
  conversion("আমি চা পছন্দ করি।", "I like tea.", ["I likes tea.", "I am like tea.", "I liking tea."]),
  conversion("এটা আমার ব্যাগ।", "This is my bag.", ["This are my bag.", "This is me bag.", "This is my bags."]),
  conversion("তুমি কী করছো?", "What are you doing?", ["What you are doing?", "What is you doing?", "What do you doing?"]),
  conversion("আমি গতকাল বাজারে গিয়েছিলাম।", "I went to the market yesterday.", ["I go to the market yesterday.", "I goed to the market yesterday.", "I am went to the market yesterday."]),
  conversion("বৃষ্টি হচ্ছে।", "It is raining.", ["It raining.", "It is rain.", "It are raining."]),
  conversion("আমার বাবা অফিসে যান।", "My father goes to the office.", ["My father go to the office.", "My father going to the office.", "My father is go to the office."]),
  conversion("সে বই পড়ছে।", "He is reading a book.", ["He reading a book.", "He is read a book.", "He are reading a book."]),
  conversion("আমরা সবাই ভালো আছি।", "We are all fine.", ["We is all fine.", "We all is fine.", "We am all fine."]),
  conversion("তুমি কি স্কুলে যাচ্ছো?", "Are you going to school?", ["Is you going to school?", "Do you going to school?", "Are you go to school?"]),
  conversion("আমার কাছে কলম নেই।", "I do not have a pen.", ["I not have a pen.", "I does not have a pen.", "I am not have a pen."]),
  conversion("সে সকালে ঘুম থেকে ওঠে।", "He gets up in the morning.", ["He get up in the morning.", "He getting up in the morning.", "He is get up in the morning."]),
  conversion("আজ শুক্রবার।", "Today is Friday.", ["Today are Friday.", "Today Friday is.", "Today is on Friday."]),
  conversion("আমরা একটি গাছ লাগিয়েছি।", "We have planted a tree.", ["We has planted a tree.", "We have plant a tree.", "We are planted a tree."]),
  conversion("সূর্য পূর্ব দিকে ওঠে।", "The sun rises in the east.", ["The sun rise in the east.", "The sun rising in the east.", "The sun is rise in the east."]),
  conversion("আমি তোমাকে ভালোবাসি।", "I love you.", ["I loves you.", "I am love you.", "I loving you."]),
  conversion("তার বয়স দশ বছর।", "He is ten years old.", ["He has ten years old.", "He is ten year old.", "He are ten years old."]),
  conversion("আমাদের স্কুল খুব সুন্দর।", "Our school is very beautiful.", ["Our school are very beautiful.", "Our school is very beauty.", "Our school very beautiful is."]),
  conversion("তুমি কখন ঘুমাও?", "When do you sleep?", ["When you sleep?", "When does you sleep?", "When are you sleep?"]),
  conversion("আমি একটি গল্প শুনছি।", "I am listening to a story.", ["I am listening a story.", "I listening to a story.", "I am listen to a story."]),
  conversion("সে খুব দ্রুত দৌড়ায়।", "He runs very fast.", ["He run very fast.", "He running very fast.", "He is run very fast."]),
  conversion("আমরা গতকাল সিনেমা দেখেছি।", "We watched a movie yesterday.", ["We watch a movie yesterday.", "We are watched a movie yesterday.", "We watching a movie yesterday."]),
  conversion("এই ফুলটি সুন্দর।", "This flower is beautiful.", ["This flower are beautiful.", "These flower is beautiful.", "This flower is beauty."]),
  conversion("শুভ সকাল।", "Good morning.", ["Good night.", "Good evening.", "Good afternoon."]),
  conversion("ধন্যবাদ।", "Thank you.", ["Sorry.", "Excuse me.", "Good bye."]),
  conversion("আমি দুঃখিত।", "I am sorry.", ["I am happy.", "I am late.", "I am fine."]),
  conversion("তোমার সাথে দেখা হয়ে ভালো লাগলো।", "Nice to meet you.", ["Nice to meat you.", "Nice meet you.", "Nice to met you."]),
  conversion("আমার নাম রহিম।", "My name is Rahim.", ["My name are Rahim.", "Me name is Rahim.", "My name Rahim is."]),
];

module.exports = { englishWordBank, englishConversionBank };
