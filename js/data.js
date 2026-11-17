// js/data.js - Workshop data: sections and story, products, sales, sensors, complaints (built from seeded generators) and the DATA object.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
function gauss(r){return Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r())}
// Seeded random numbers for the generators below (mulberry32).
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// ─── Constants ───
const APP_ID='rybex-ai-workshop',STORE_KEY='rybexws',FILE_VERSION=3,TEAM_COUNT=8,MIN_EXPERIMENTS=3,PREVIEW_ROWS=40,TOAST_MS=8000,TOAST_ACTION_MS=20000,WEAK_SIM=.35,FONT_WAIT_MS=1500;
const TONE={vision:'grape',rag:'blue',complaints:'yellow',forecast:'green',maint:'ink'};
const INK='#1C1917',INK3='#625B53',LINE='#E0DBD3',PAPER='#FFFFFF',BLUE='#177AA8',GRAPE='#7A5AC2',GREEN='#078342',RED='#C92823',BERRY='#C6478B',YELLOW='#FFD500';

/* ================= content: brief sections ================= */
const SEC=()=>[
{id:1,t:T('Jak system wykonuje zadanie'),items:[
 T('Wejście: jakie dane system otrzymuje'),
 T('Przetwarzanie: jak dane są przetwarzane'),
 T('Wyjście: jaki wynik trafia do użytkownika')]},
{id:2,t:T('Dane'),items:[
 T('Rodzaj i format danych (zdjęcia, dokumenty, sprzedaż, czujniki)'),
 T('Źródła danych i sposób ich pozyskania'),
 T('Przygotowanie: czyszczenie, uzupełnianie, oznaczanie, przekształcanie'),
 T('Podział na dane do budowy i niezależnego testowania'),
 T('Ograniczenia zbioru (mało przykładów, braki, nierówna reprezentacja) i zgodność danych zastępczych z warunkami Rybex')]},
{id:3,t:T('Technologia i architektura'),items:[
 T('Model lub metoda AI wraz z uzasadnieniem'),
 T('Biblioteki, narzędzia, środowisko wykonawcze'),
 T('Infrastruktura: lokalna / chmurowa / hybrydowa'),
 T('Przechowywanie i przetwarzanie danych'),
 T('Interfejs użytkownika i integracje'),
 T('Schemat blokowy architektury (źródło → komponenty → wynik)')]},
{id:4,t:T('Prototyp i przebieg prac'),items:[
 T('Działający prototyp, który wykonuje główną funkcję'),
 T('Instrukcja uruchomienia'),
 T('Przeprowadzone eksperymenty i decyzje projektowe'),
 T('Zasoby, czas i koszt (jeśli model trenowano lub dostrajano)')]},
{id:5,t:T('Ocena działania'),items:[
 T('Miary dobrane do zadania (P/R/F1, błąd prognozy, poprawność odpowiedzi, czas, koszt)'),
 T('Przykłady poprawnego działania i błędów'),
 T('Ograniczenia rozwiązania i wnioski'),
 T('Porównanie z prostą metodą odniesienia (reguły / średnia historyczna)')]},
{id:6,t:T('Rezultaty części technologicznej'),items:[
 T('Dokumentacja danych, technologii i architektury'),
 T('Prototyp wraz z instrukcją uruchomienia'),
 T('Wyniki testów i analiza błędów'),
 T('Szacunek zasobów i kosztów technicznych'),
 T('Dalsze prace: integracje, monitorowanie jakości, utrzymanie')]}];

const SEC_ICONS=['target','database','network','flask-conical','gauge','package-check'],SEC_TONES=['grape','blue','yellow','green','ink','stone'];
const checkProgress=t=>{let done=0,tot=0;SEC().forEach(s=>s.items.forEach((_,n)=>{tot++;if(t.checks[s.id+'.'+n])done++}));return{done,tot}};

const LOT='RYB-261031-L2';
// The incident behind the whole workshop: one source for the batch, the product and the memo's date and addressee.
const STORY=()=>({lot:LOT,product:0,date:T('3 listopada 2026'),to:T('nowy zespół ds. rozwiązań AI')});
const PRODUCTS=[['Szprot w oleju','Sprat in oil',120],['Makrela w pomidorach','Mackerel in tomato',90],['Śledź po kaszubsku','Herring Kashubian style',70],['Tuńczyk w sosie własnym','Tuna in own sauce',60]];
// Company site pages (route #/rybex/<page>); keys stay English, the address bar shows the Polish slugs.
const RYBEX_PAGES=['home','about','products','quality','news','contact','career','intranet'];
const SEAS=[.9,.8,1.15,1.15,1,.95,1.1,1,1,1.05,1.05,1.4];
const monthLbl=i=>{const y=2023+Math.floor((10+i)/12),m=(10+i)%12;return y+'-'+String(m+1).padStart(2,'0')};
function buildSales(){const r=rng(11),rows=[];for(let p=0;p<4;p++)for(let i=0;i<36;i++){const m=(10+i)%12;rows.push({month:monthLbl(i),product:PRODUCTS[p][0],units_k:Math.round(PRODUCTS[p][2]*(1+.008*i)*SEAS[m]*(1+(r()-.5)*.12))})}return rows}
// Failure events [start minute, kind]: v = seamer (vibration), t = retort (temperature + pressure), b = both; each lasts SENSOR_EVENT_LEN minutes.
const SENSOR_EVENTS=[[60,'v'],[140,'t'],[230,'b'],[350,'v'],[430,'t'],[520,'b']],SENSOR_EVENT_LEN=14;
function buildSensors(){const r=rng(5),rows=[],W=SENSOR_EVENTS;
 for(let i=0;i<600;i++){let t=121+gauss(r)*.6,p=2.1+gauss(r)*.05,v=2+gauss(r)*.25,y=0;
  for(const[s,k]of W)if(i>=s&&i<s+SENSOR_EVENT_LEN){const ramp=(i-s+1)/SENSOR_EVENT_LEN;y=1;if(k!='t')v+=ramp*3.2;if(k!='v')t+=ramp*5;if(k=='t')p+=ramp*.35}
  rows.push({t_min:i,temp_c:+t.toFixed(2),pressure_bar:+p.toFixed(3),vibration_mm_s:+v.toFixed(2),anomaly:y})}return rows}
const CAT={damage:['Uszkodzenie puszki','Damaged can'],label:['Etykieta i oznaczenia','Label and markings'],quality:['Jakość produktu','Product quality'],delivery:['Dostawa / faktura','Delivery / invoice'],smell:['Zapach / świeżość','Smell / freshness']};
const CK=Object.keys(CAT);
// Complaint cases: [category, hazard, text]. Labels follow the Rybex labelling guideline (COMPL_GUIDE), not the first problem mentioned:
// transport damage is "delivery"; with several problems the priority is smell > damage > label > quality > delivery.
const CTPL={
 d1:['damage',0,'Dwie puszki {p} miały głębokie wgniecenia przy zgrzewie, jedna lekko przeciekała.'],
 d2:['damage',0,'Puszka {p} zardzewiała na krawędzi, jakby długo stała w wilgoci.'],
 d3:['damage',0,'Przy otwieraniu wieczko się urwało, a krawędź puszki {p} była poszarpana.'],
 d4:['damage',0,'Na dnie puszki {p} jest wgniecenie, a lakier z boku popękał.'],
 dh1:['damage',1,'Puszka {p} wybrzuszona, wieczko wypukłe, a przy otwieraniu coś syknęło.'],
 dh2:['damage',1,'Puszka {p} jest napuchnięta, denko odstaje i ugina się pod palcem.'],
 l1:['label',0,'Data przydatności na puszce {p} jest zamazana, nie da się jej odczytać.'],
 l2:['label',0,'Etykieta {p} naklejona do góry nogami, kod partii częściowo starty.'],
 l3:['label',0,'Na puszce {p} brakuje kodu partii, więc nie mogę go podać w reklamacji.'],
 l4:['label',0,'Na etykiecie {p} jest inna gramatura niż na fakturze i w sklepie internetowym.'],
 q1:['quality',0,'Ryba w puszce {p} była sucha, łykowata i rozpadała się na papkę.'],
 q2:['quality',0,'W puszce {p} pełno ości, a ryby może jedna trzecia.'],
 q3:['quality',0,'Pachniało normalnie, ale ryba w puszce {p} była tak słona, że nie dało się jej zjeść.'],
 q4:['quality',0,'Kawałki ryby w puszce {p} ciemne i twarde, zupełnie inne niż zwykle.'],
 s1:['smell',1,'Po otwarciu puszki {p} poczułem kwaśny, nieprzyjemny zapach.'],
 s2:['smell',1,'Olej w puszce {p} był mętny i dziwnie pachniał, nie odważyłem się zjeść.'],
 s3:['smell',1,'Ryba z puszki {p} miała posmak metalu i zapach zepsucia, po zjedzeniu bolał mnie brzuch.'],
 s4:['smell',1,'Smród po otwarciu puszki {p}, wyrzuciłam całość.'],
 v1:['delivery',0,'Zamówienie hurtowe ({p}, 40 kartonów) dotarło z tygodniowym opóźnieniem.'],
 v2:['delivery',0,'Faktura obejmuje 12 kartonów {p}, a dostaliśmy 10.'],
 v3:['delivery',0,'Kurier rzucał paczkami, karton był zgnieciony i trzy puszki {p} są wgniecione.'],
 v4:['delivery',0,'Paleta przyszła źle owinięta folią, kartony przemoknięte, a puszki {p} poobijane w transporcie.'],
 m1:['smell',1,'Dostawa przyszła dwa dni po terminie, a po otwarciu jednej puszki {p} poczuliśmy zepsuty zapach.'],
 m2:['damage',0,'Etykieta była krzywo naklejona, ale gorzej, że puszka {p} była wgnieciona i przeciekała.'],
 m3:['label',0,'Ryba w puszce {p} była za słona, a do tego na etykiecie nie da się odczytać daty ważności.'],
 m4:['quality',0,'Faktura nie zgadza się z zamówieniem, a ryba w puszce {p} sucha i pełna ości.'],
 m5:['damage',1,'Opakowanie zbiorcze przyszło z opóźnieniem, a wieczko jednej puszki {p} było wypukłe.'],
 m6:['damage',0,'Smak w porządku, ale puszka {p} zardzewiała i ma zamazany kod partii.']};
// Order fixes what lands where: 1–20 = few-shot pool, 21–36 = dev scored with examples, 37–60 = test. Every part holds transport and mixed cases.
const C_PLAN=['m2','l1','m1','v3','m3','q1','d2','v1','s2','q3','dh1','l3','v2','m4','s1','d1','l4','q2','v4','s4',
 'v4','m5','q4','l2','s3','m6','v3','d3','m3','dh2','q3','v1','m1','l1','d4','m4',
 's1','v3','m2','l3','q1','m6','dh1','v4','m3','d1','s4','m4','l4','v2','m1','q2','d2','m5','l1','q3','v1','s2','d3','v4'];
const C_OPEN=['','Dzień dobry. ','Reklamacja. ','Witam, ','Szanowni Państwo, '],C_CLOSE=['',' Proszę o zwrot pieniędzy.',' Czekam na odpowiedź.',' Proszę o kontakt.',' To już drugi raz w tym miesiącu.'];
function buildComplaints(){const r=rng(21);return C_PLAN.map((k,i)=>{const[c,h,t]=CTPL[k],pr=PRODUCTS[Math.floor(r()*4)][0],o=C_OPEN[Math.floor(r()*5)],e=C_CLOSE[Math.floor(r()*5)];
 return Object.defineProperty({id:i+1,product:pr,text:o+t.replace('{p}','„'+pr+'”')+e,category:c},'hazard',{value:!!h,enumerable:false})})}
const DATA={sales:buildSales(),sensors:buildSensors(),compl:buildComplaints()};

// Knowledge-assistant corpus: current procedures, a workstation instruction, a quality FAQ, a change memo and one archived procedure version (ARCH-01)
// Kept in folder (alphabetical) order: the literal baseline and TF-IDF give ties to the earlier document, so reordering changes the results
