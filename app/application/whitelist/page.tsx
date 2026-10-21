import ApplicationForm from '@/components/ApplicationForm';
const q=[
{name:'realName',label:'YOUR REAL NAME',placeholder:'Your real name'},
{name:'realAge',label:'YOUR REAL AGE',placeholder:'Your real age'},
{name:'characterName',label:'Character Full Name',placeholder:"Your character's full name"},
{name:'characterAge',label:'Character Age',placeholder:"Your character's age"},
{name:'legal',label:'Legal or Illegal',placeholder:'Legal or Illegal',type:'select' as const,options:['Legal','Illegal']},
{name:'background',label:'Character Background (Brief Description)',placeholder:'Describe your character past, childhood, major events, struggles and traumas.',type:'textarea' as const},
{name:'transition',label:'Transition to the City',placeholder:'Explain why your character came to the city.',type:'textarea' as const},
{name:'physical',label:'Physical Description',placeholder:'Describe appearance, skin tone, face, eyes, hair, body type, disabilities and clothing.',type:'textarea' as const},
{name:'personality',label:'Personality & Psychological Description',placeholder:'Describe personality, fears, phobias, habits, language, accent and unique characteristics.',type:'textarea' as const},
{name:'goals',label:'Future Goals & Ambitions',placeholder:'Describe future goals and objectives.',type:'textarea' as const}
];
export default function Page(){return <ApplicationForm title="Whitelist Application" intro="Apply to get whitelist access and join the city." endpoint="/api/applications/whitelist" questions={q}/>}