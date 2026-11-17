// js/constants.js - Constants: RAG questions, briefs, navigation, file list, cards, keyword lists, lanes, presets, AI defaults and shots.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
const RQ=[
 {q:['W jakiej temperaturze sterylizuje się puszki 170 g?','At what temperature are 170 g cans sterilized?'],doc:'PROCES-02',type:'direct',ok:/121/},
 {q:['Jak gorąco ma być w autoklawie?','How hot should the autoclave get?'],doc:'PROCES-02',type:'para',ok:/121/},
 {q:['Co ile minut kontroluje się szew puszki?','How often is the can seam inspected?'],doc:'PROCES-01',type:'version',ok:/co 30 min|every 30 min/,bad:/60 min/},
 {q:['Ile minut sterylizuje się puszki 300 g?','For how many minutes are 300 g cans sterilized?'],doc:'PROCES-02',type:'context',ok:/55 min/,bad:/40 min/},
 {q:['Klient zgłasza wybrzuszoną puszkę. Ile mam czasu na przekazanie sprawy i co dzieje się z partią?','A customer reports a bulging can. How much time do I have to pass the case on, and what happens to the batch?'],doc:['PROCES-04','PROCES-06'],type:'multi',ok:[/24 godz|24 hours/,/wstrzym|hold|held/]},
 {q:['Co ile zmieniać rękawiczki?','How often do I swap gloves?'],doc:'PROCES-07',type:'para',ok:/co 2 godzin|every 2 hours/},
 {q:['Jaki format ma kod partii?','What is the batch code format?'],doc:'PROCES-03',type:'direct',ok:/RYB-(RRMMDD|YYMMDD)/},
 {q:['Co ile godzin smaruje się zamykarkę?','How often is the seamer lubricated?'],doc:'PROCES-05',type:'direct',ok:/\b8 godzin|\b8 hours/},
 {q:['O ile milimetrów może być przesunięta etykieta?','How far may the label be shifted from the can axis?'],doc:'PROCES-03',type:'direct',ok:/2 mm/},
 {q:['W ciągu ilu dni odpowiadamy na reklamację?','Within how many days is a complaint answered?'],doc:'PROCES-04',type:'direct',ok:/14 dni|14 days/},
 {q:['Powyżej jakich drgań konieczny jest natychmiastowy przegląd maszyny?','Above what vibration must the machine be inspected immediately?'],doc:'PROCES-05',type:'direct',ok:/(powyżej|ponad|przekrocz\S*) 4 mm\/s|(above|over|exceed\S*) 4 mm\/s/},
 {q:['Ile ma stygnąć puszka w retorcie?','How long do cans cool down in the retort?'],doc:'PROCES-02',type:'para',ok:/20 min/},
 {q:['Klient pisze, że ryba śmierdzi. Komu to dać i jak szybko?','A customer writes that the fish stinks. Who gets it and how fast?'],doc:'PROCES-04',type:'para',ok:/24 godz|24 hours/},
 {q:['Kod na puszce się rozmazał, co z taką puszką?','The code on a can is smudged, what happens to that can?'],doc:'PROCES-03',type:'para',ok:/ponown\w* znakow|znakow\w* ponown|re-?mark(ed|ing)|marked again/},
 {q:['Ile dekli ma zostać w magazynku, zanim dołożę nowe?','How many lids should be left in the magazine before I top it up?'],doc:'INSTR-01',type:'para',ok:/jedna czwarta|jednej czwartej|one quarter/},
 {q:['Puszka spadła na ziemię. Mogę ją wrzucić z powrotem na taśmę?','A can dropped on the ground. Can I throw it back on the belt?'],doc:'FAQ-01',type:'para',ok:/(podłog|ziemi)[^.]*odpad|(floor|ground)[^.]*waste/},
 {q:['Jak długo ważna jest konserwa w pomidorach?','How long is a can in tomato sauce good for?'],doc:'PROCES-03',type:'para',ok:/24 mies|24 months/},
 {q:['Po ilu puszkach zmieniamy rolki?','How many cans until the rollers are replaced?'],doc:'PROCES-05',type:'para',ok:/500/},
 {q:['Czyj podpis zwalnia wstrzymaną partię?','Whose signature releases a held batch?'],doc:'PROCES-06',type:'para',ok:/zwalnia[^.]*kierownik\w* działu jakości|released?[^.]*quality manager|quality manager[^.]*releases?/},
 {q:['Do jakiej kwoty mogę sama zatwierdzić zwrot?','Up to what amount can I approve a refund myself?'],doc:'PROCES-04',type:'para',ok:/200 zł/},
 {q:['Ile kosze mają stać na suszeniu?','How long does a basket stay in drying?'],doc:'PROCES-02',type:'para',ok:/\b6 godzin|\b6 hours/},
 {q:['Jak często wykonuje się rozbiórkę szwu?','How often is a seam teardown done?'],doc:'PROCES-01',type:'version',ok:/\b4 godz|\b4 hours/,bad:/raz na zmian|once per shift|once a shift/},
 {q:['Jak długo przechowuje się karty kontrolne szwu?','How long are seam control cards kept?'],doc:'PROCES-01',type:'version',ok:/3 lat|3 years/,bad:/2 lat|2 years/},
 {q:['Jaka grubość szwu jest dopuszczalna?','What seam thickness is acceptable?'],doc:'PROCES-01',type:'version',ok:/1,15|1\.15/,bad:/1,20|1\.20/},
 {q:['Ile minut spłukiwać linię po sosie musztardowym?','For how many minutes is the line rinsed after mustard sauce?'],doc:'PROCES-07',type:'context',ok:/25 min/,bad:/10 min/},
 {q:['Jaką temperaturę musi mieć ryba mrożona przy przyjęciu?','What temperature must frozen fish have on receipt?'],doc:'PROCES-08',type:'context',ok:/18 ?°C/,bad:/0 do 2|0 to 2/},
 {q:['Z jaką prędkością pracuje zamykarka po przezbrojeniu?','At what speed is the seamer run after a changeover?'],doc:'INSTR-01',type:'context',ok:/120/,bad:/300/},
 {q:['Po zaniku prądu w retorcie: ile razy wolno powtórzyć cykl i na jakim formularzu zwalnia się potem partię?','After a power cut in the retort: how many times may the cycle be repeated, and on which form is the batch released afterwards?'],doc:['PROCES-02','PROCES-06'],type:'multi',ok:[/tylko raz|jeden raz|jednokrotn|only once|one time/,/F-12/]},
 {q:['Ile dni mamy na odpowiedź na reklamację i jak długo zakład trzyma próbkę archiwalną z partii?','How many days do we have to answer a complaint, and how long does the plant keep the retention sample of a batch?'],doc:['PROCES-04','PROCES-06'],type:'multi',ok:[/14 dni|14 days/,/3 mies|3 months|three months|trzy mies/]},
 {q:['Kto przezbraja zamykarkę i co ile minut kontroluje się potem szew?','Who does a seamer changeover, and how often is the seam inspected afterwards?'],doc:['INSTR-01','PROCES-01'],type:'multi',ok:[/mechanik|mechanic/,/10 min/]},
 {q:['Ile kosztuje puszka?','How much does a can cost?'],type:'oos',oos:1},
 {q:['Jaka jest pogoda w Warszawie?','What is the weather in Warsaw?'],type:'oos',oos:1},
 {q:['Kto jest prezesem Rybex?','Who is the CEO of Rybex?'],type:'oos',oos:1},
 {q:['Ile dni urlopu ma operator zamykarki?','How many days of leave does a seamer operator get?'],type:'oos',oos:1},
 {q:['Ile kosztuje godzina postoju linii 2?','How much does an hour of downtime on line 2 cost?'],type:'oos',oos:1},
 {q:['Jaka jest premia za pracę na nocnej zmianie?','What is the bonus for working the night shift?'],type:'oos',oos:1}];
const BRIEF_PL="> Sprawa zaczyna się od incydentu w zakładzie Rybex w Mirszycach: sieć handlowa zwróciła paletę „Szprota w oleju” z partii "+LOT+" z powodu wgnieceń i nieczytelnego kodu partii. W tym samym tygodniu do skrzynki reklamacji wpłynęło więcej zgłoszeń niż zwykle, w tym sygnały o zapachu. Dyrektor zakładu prosi nowy zespół AI o jasny opis problemu, sprawdzenie prostych reguł i uczciwą ocenę, czy taki system można puścić bliżej linii.\n\n# Projekt końcowy – część technologiczna\n## Rozwiązanie AI dla firmy Rybex\n\n### Cel projektu\n\nCelem projektu jest zaprojektowanie i sprawdzenie rozwiązania wykorzystującego sztuczną inteligencję w firmie **Rybex – producencie konserw rybnych**. Zespół wybiera jeden problem, opracowuje koncepcję techniczną oraz przygotowuje **Proof of Concept (PoC)**, czyli prototyp pozwalający zweryfikować najważniejsze założenia rozwiązania.\n\nProjekt powinien pokazywać, jak przejść od określenia zadania i pozyskania danych do uruchomienia systemu AI oraz oceny jego działania.\n\n### 1. Wybór zadania\n\nNależy opisać zadanie, które wykonuje system: jakie dane otrzymuje, jak je przetwarza i jaki wynik zwraca użytkownikowi.\n\nPrzykładowe tematy dla firmy Rybex:\n\n- **Wizyjna kontrola jakości** – wykrywanie uszkodzeń puszek, nieprawidłowych etykiet lub nieczytelnych oznaczeń partii.\n- **Prognozowanie popytu** – przewidywanie zapotrzebowania na poszczególne produkty na podstawie danych historycznych.\n- **Przewidywanie awarii maszyn** – wykrywanie nieprawidłowości w danych z urządzeń produkcyjnych.\n- **Asystent wiedzy firmowej** – wyszukiwanie informacji i udzielanie odpowiedzi na podstawie instrukcji obsługi, procedur i dokumentacji technicznej.\n- **Analiza reklamacji** – klasyfikowanie zgłoszeń, identyfikowanie powtarzających się problemów i przygotowywanie projektów odpowiedzi.\n\n### 2. Dane\n\nNależy określić:\n\n- rodzaj i format potrzebnych danych, np. zdjęcia, dokumenty, historia sprzedaży lub odczyty z czujników;\n- źródła danych i sposób ich pozyskania;\n- zakres przygotowania danych: czyszczenie, uzupełnianie, oznaczanie i przekształcanie;\n- sposób podziału danych do budowy rozwiązania i niezależnego testowania;\n- ograniczenia zbioru, np. małą liczbę przykładów, braki lub nierównomierną reprezentację kategorii.\n\nMożna wykorzystać dane firmowe, publiczne zbiory danych lub dane symulowane. Jeśli zespół korzysta z danych zastępczych, należy wyjaśnić, w jakim stopniu odpowiadają warunkom pracy w firmie Rybex.\n\n### 3. Technologia i architektura\n\nNależy przedstawić i uzasadnić wybór:\n\n- modelu lub metody AI;\n- bibliotek, narzędzi i środowiska wykonawczego;\n- infrastruktury: lokalnej, chmurowej lub hybrydowej;\n- sposobu przechowywania i przetwarzania danych;\n- interfejsu użytkownika oraz ewentualnych integracji z innymi systemami.\n\nDokumentacja powinna zawierać **schemat blokowy architektury**, który pokazuje przepływ danych od źródła przez komponenty systemu do wyniku.\n\nRozwiązanie może korzystać z gotowego modelu, zewnętrznego API, mechanizmu RAG lub modelu trenowanego przez zespół. Trenowanie własnego modelu nie jest konieczne – wybór podejścia powinien wynikać z zadania.\n\n### 4. Prototyp i przebieg prac\n\nCzęść praktyczna może mieć postać:\n\n- prostej aplikacji AI, która wykonuje wybrane zadanie;\n- narzędzia lub notatnika do trenowania i testowania modelu;\n- demonstratora wykorzystującego gotowy model lub usługę AI.\n\nNależy opisać sposób uruchomienia prototypu, przeprowadzone eksperymenty oraz najważniejsze decyzje projektowe. Jeśli model był trenowany lub dostrajany, należy podać wykorzystane zasoby, czas i szacunkowy koszt tego procesu.\n\nPrototyp powinien pozwalać sprawdzić główną funkcję systemu.\n\n### 5. Ocena działania\n\nNależy dobrać miary odpowiadające zadaniu, np.:\n\n- precyzję, czułość lub F1 dla klasyfikacji i wykrywania nieprawidłowości;\n- błąd prognozy dla przewidywania popytu;\n- poprawność odpowiedzi i zgodność ze źródłami dla asystenta wiedzy;\n- czas odpowiedzi, zużycie zasobów i koszt pojedynczego wywołania.\n\nOcena powinna obejmować przykłady poprawnego działania i błędów, ograniczenia rozwiązania oraz wnioski z testów. Warto porównać wyniki z prostą metodą odniesienia, np. regułami lub prognozą opartą na średniej historycznej.\n\n### 6. Rezultaty części technologicznej\n\nZespół przedstawia:\n\n- dokumentację danych, technologii i architektury;\n- prototyp lub środowisko eksperymentalne wraz z instrukcją uruchomienia;\n- wyniki testów i analizę błędów;\n- szacunek zapotrzebowania na zasoby oraz kosztów technicznych;\n- opis dalszych prac potrzebnych do wdrożenia, w tym integracji, monitorowania jakości i utrzymania systemu.\n";
const BRIEF_EN=`> The case starts with an incident at the Rybex plant in Mirszyce: a retail chain returned a pallet of “Sprat in oil” from batch ${LOT} because of dents and an unreadable batch code. In the same week the complaints team received more reports than usual, including reports about the smell. The plant director asks the new AI team for a clear description of the problem, a check of simple rules and an honest assessment of whether such a system can be put closer to the line.

# Final project – technology part
## An AI solution for Rybex

### Project goal

Design and test a solution using artificial intelligence at **Rybex, a fish-can manufacturer**. The team picks one problem, develops a technical concept and prepares a **Proof of Concept (PoC)**, a prototype that verifies the most important assumptions of the solution.

The project should show how to move from defining the task and obtaining data to running an AI system and assessing how it works.

### 1. Task selection

Describe the task performed by the system: what data it receives, how it processes them and what result it returns to the user.

Example topics for Rybex:

- **Visual quality inspection** – detecting damaged cans, incorrect labels or illegible batch markings.
- **Demand forecasting** – predicting demand for individual products from historical data.
- **Machine failure prediction** – analysing data from production equipment to detect irregularities.
- **Company knowledge assistant** – finding information and answering from manuals, procedures and technical documentation.
- **Complaint analysis** – classifying reports, identifying recurring problems and preparing draft replies.

### 2. Data

Specify:

- the type and format of the data needed, e.g. images, documents, sales history or sensor readings;
- data sources and how they are obtained;
- the scope of data preparation: cleaning, filling gaps, labeling and transforming;
- how the data are split between building the solution and independent testing;
- dataset limits, e.g. few examples, gaps or uneven representation of categories.

You may use company data, public datasets or simulated data. For substitute data, explain how closely they match working conditions at Rybex.

### 3. Technology and architecture

Present and justify the choice of:

- the AI model or method;
- libraries, tools and runtime environment;
- infrastructure: local, cloud or hybrid;
- how data are stored and processed;
- the user interface and any integrations with other systems.

The documentation should include a **block diagram of the architecture**, showing data flow from the source through the system components to the result.

The solution may use a ready model, an external API, a RAG mechanism or a model trained by the team. Training your own model is not required – the approach should follow from the task.

### 4. Prototype and work process

The practical part may take the form of:

- a simple AI application performing the chosen task;
- a tool or notebook for training and testing a model;
- a demonstrator using a ready model or AI service.

Describe how to run the prototype, the experiments carried out and the most important design decisions. If a model was trained or tuned, state the resources, time and estimated cost of that process.

The scope of the prototype should allow the main function of the system to be checked.

### 5. Evaluation

Choose measures suited to the task, e.g.:

- precision, recall or F1 for classification and anomaly detection;
- forecast error for demand prediction;
- answer correctness and agreement with sources for the knowledge assistant;
- response time, resource use and cost per call.

The evaluation should include examples of correct behaviour and errors, the limits of the solution and conclusions from the tests. It is worth comparing results with a simple baseline, e.g. rules or a forecast based on the historical mean.

### 6. Results of the technology part

The team presents:

- documentation of data, technology and architecture;
- a prototype or experimental environment with run instructions;
- test results and error analysis;
- an estimate of resource needs and technical costs;
- a description of further work needed for deployment, including integration, quality monitoring and system maintenance.
`;

function drawCan(c,seed,type){const x=c.getContext('2d',{willReadFrequently:true}),r=rng(seed);
 x.fillStyle='#F5F3F0';x.fillRect(0,0,160,200);
 let g=x.createLinearGradient(30,0,130,0);g.addColorStop(0,'#857C69');g.addColorStop(.35,'#EAE6E0');g.addColorStop(1,'#857C69');
 x.fillStyle=g;x.fillRect(30,20,100,160);
 x.fillStyle='#625B53';x.fillRect(30,20,100,3);x.fillRect(30,177,100,3);
 const lt=60+(type==='label'?(2.5+r()*11.5)*(r()<.5?-1:1):(r()-.5)*7);
 x.fillStyle='#177AA8';x.fillRect(30,lt,100,80);x.fillStyle='#FFFFFF';x.fillRect(30,lt+36,100,6);
 x.fillStyle='#FFD500';x.beginPath();x.ellipse(82,lt+20,24,8,0,0,7);x.fill();
 const tg=Math.floor(20+r()*90);x.fillStyle=`rgb(${tg},${tg},${tg})`;x.font='bold 11px monospace';x.fillText(LOT,34,170);
 if(type==='code'){for(let k=0,K=2+Math.floor(r()*6);k<K;k++){x.fillStyle='rgba(205,210,214,.8)';x.beginPath();x.ellipse(40+r()*80,166,8+r()*8,3+r()*3,0,0,7);x.fill()}}
 if(type==='dent'){const cx=48+r()*64,cy=28+r()*20,rr=4+r()*13,al=.4+r()*.5,rg=x.createRadialGradient(cx,cy,1,cx,cy,rr);rg.addColorStop(0,`rgba(35,40,45,${al})`);rg.addColorStop(1,'rgba(35,40,45,0)');x.fillStyle=rg;x.fillRect(30,20,100,40)}
 if(type==='ok'&&r()<.2){const cx=45+r()*70,cy=28+r()*20,rr=3+r()*3,rg=x.createRadialGradient(cx,cy,0,cx,cy,rr);rg.addColorStop(0,'rgba(40,45,50,.7)');rg.addColorStop(1,'rgba(40,45,50,0)');x.fillStyle=rg;x.fillRect(30,20,100,40)}
 for(let k=0;k<120;k++){x.fillStyle='rgba(0,0,0,.05)';x.fillRect(30+r()*100,20+r()*160,1,1)}
 const d=x.getImageData(0,0,160,200).data,L=(px,py)=>{const i=(py*160+px)*4;return .3*d[i]+.59*d[i+1]+.11*d[i+2]};
 let dark=0,n=0;for(let py=24;py<58;py++)for(let px=32;px<128;px++){const i=(py*160+px)*4;n++;if(L(px,py)<100&&Math.abs(d[i]-d[i+2])<30)dark++}
 let top=20;for(let py=20;py<180;py++){const i=(py*160+45)*4;if(d[i+2]>d[i]+60){top=py;break}}
 let e=0,m=0;for(let py=160;py<176;py++)for(let px=34;px<126;px++){e+=Math.abs(L(px,py)-L(px+1,py));m++}
 return{dent:dark/n*1000,shift:Math.abs(top-60),code:e/m}}
const NAV=[['home','house',['Start','Start']],['brief','clipboard-list',['Opis projektu','Brief']],['data','folder-open',['Dane','Data']],['demos','clapperboard',['Demonstracje','Demos']],['lab','flask-conical',['Laboratorium','Build lab']],['arch','network',['Architektura','Architecture']],['deliver','circle-check',['Wyniki i raport','Results and report']]];
const DEMO_KEYS=['life','tok','rag','split','metr','risk'],LAB_KEYS=['vision','rag','complaints','forecast','maint'];
function visionDataSource(){return VIS.photoCount?T(`Wygenerowane fotografie Rybex (wczytano ${VIS.photoCount}/${VIS.expectedPhotoCount}); w miejsce brakujących aplikacja wstawia obrazy syntetyczne.`,`Generated Rybex photographic images (${VIS.photoCount}/${VIS.expectedPhotoCount} loaded); missing items use the synthetic fallback.`):T('Syntetyczny obraz bazowy generowany w przeglądarce; fotografie nie zostały wczytane.')}
function visionAssetSizeNote(){return T('Aplikacja pobiera wygenerowane obrazy 320×400 px (WebP) z assets/vision-generated/web/; galeria, podgląd, model i ZIP używają tej samej rozdzielczości.')}
function visionDataCount(){return`${VISION_SPLIT_COUNTS.train} ${T('treningowych')} + ${VISION_SPLIT_COUNTS.val} ${T('w zestawie ćwiczeniowym')} + ${VISION_SPLIT_COUNTS.test} ${T('w teście końcowym')} = ${VISION_ASSET_TOTAL}`}
const FILES=()=>[
 {d:'01_brief',f:[['project_description.md','md']]},
 {d:'data/vision',f:[['can_images/ (210)','img']]},
 {d:'data',f:[['sales_history.csv','sales'],['sensors.csv','sensors'],['complaints.csv','compl']]},
 {d:'docs',f:DOCS.map(d=>[d.id+'.md','doc:'+d.id])},
 {d:'outputs',f:[['team_log.md','log'],['architecture.svg','svg']]}];
const CARDS=()=>({
 img:{src:visionDataSource(),n:visionDataCount(),prep:VIS.featureSource==='photo'?T('Etykiety pozostają niezmienne; reguły liczą cechy pikseli z tych samych zdjęć (kopia 160×200 px), a model/API dostaje zdjęcie jako data URL.'):T('Etykiety pozostają niezmienne; reguły używają cech bazowych z obrazu syntetycznego, a model/API dostaje fotografię jako data URL.'),split:T('Zestaw treningowy ustawia progi startowe, na zestawie ćwiczeniowym (walidacja) stroicie suwaki, test końcowy służy tylko do oceny na koniec'),lim:T('Zdjęcia mogą różnić się oświetleniem, tłem i rozdzielczością; w miejsce brakujących plików aplikacja jawnie wstawia obrazy syntetyczne.'),proxy:T('Na linii Rybex wady są rzadsze (<1%), a zdjęcia mniej jednolite – realne wyniki będą gorsze.')},
 sales:{src:T('Dane symulowane: 4 produkty × 36 miesięcy, trend, sezonowość (Wielki Post, Boże Narodzenie), szum'),n:'144 '+T('wierszy'),prep:T('Brak braków; w praktyce: uzupełnianie luk, korekta promocji i braków magazynowych'),split:T('Podział chronologiczny: ostatnie miesiące jako test (nie losowo!)'),lim:T('Tylko 3 cykle roczne; brak cen, promocji, pogody'),proxy:T('Przybliża dane z ERP; rzeczywiste szeregi mają skoki promocyjne i nieregularności.')},
 sensors:{src:T('Dane symulowane z zamykarki/retortu: temperatura, ciśnienie, drgania co minutę; 6 okien awarii'),n:'600 '+T('wierszy'),prep:T('Wiadomo, w których minutach była awaria (kolumna anomaly); normę maszyny liczymy tylko z minut treningowych bez awarii'),split:T('Pierwsze 300 min – trening, kolejne 300 – test'),lim:T('Tylko 6 zdarzeń; rodzaje awarii uproszczone'),proxy:T('Prawdziwe dane ze sterownika maszyny (PLC) zmieniają się z czasem (dryf) i bywają zapisywane częściej albo rzadziej niż co minutę.')},
 compl:{src:T('Dane symulowane: 60 zgłoszeń klientów w 5 kategoriach; ok. 1/3 to przypadki trudne: uszkodzenia w transporcie i zgłoszenia opisujące kilka problemów'),n:'60 '+T('wierszy'),prep:T('Kategorie nadane przez dział reklamacji według jego instrukcji (uszkodzenia w transporcie, priorytet problemów; treść w Laboratorium → Analiza reklamacji); w praktyce także anonimizacja danych osobowych (RODO)'),split:T('Pierwsze 36 – zestaw ćwiczeniowy (na nim poprawiacie słowa kluczowe), ostatnie 24 – test końcowy (zakryty, odsłaniany raz)'),lim:T('Krótkie teksty pisane według wzorów; realne zgłoszenia są dłuższe, z literówkami i emocjami'),proxy:T('Kategoria zależy od procesu w firmie (kto płaci za szkodę, co jest pilniejsze), a nie tylko od treści: tak jest też w realnych działach reklamacji.')},
 doc:{src:(n=>T(`Dokumenty symulowane: ${n} procedur, instrukcja stanowiskowa, pytania pracowników (FAQ), komunikat o zmianie procedury i archiwalna wersja kontroli szwu`,`Simulated documents: ${n} procedures, a workstation instruction, employee questions (FAQ), a procedure change notice and an archived version of the seam inspection`))(DOCS.filter(d=>d.id.startsWith('PROCES')).length),n:DOCS.length+' '+T('dokumentów, ')+DOCS.reduce((a,d)=>a+d.p[0].length,0)+' '+T('akapitów'),prep:T('Dokumenty pocięte na krótkie fragmenty, żeby asystent mógł je przeszukiwać (chunking, indeksowanie)'),split:(([d,t])=>T(`${RQ.length} pytań ze znaną odpowiedzią: ${d[0]+d[1]} w zestawie ćwiczeniowym (w tym ${d[1]}, na które w dokumentach nie ma odpowiedzi) i ${t[0]+t[1]} w teście końcowym, zakrytym do końca (w tym ${t[1]} bez odpowiedzi w dokumentach)`,`${RQ.length} questions with a known answer: ${d[0]+d[1]} in the practice set (${d[1]} of them not answered by the documents) and ${t[0]+t[1]} in the final test, hidden until the end (${t[1]} of them not answered by the documents)`))([RQ_DEV,RQ_TEST].map(x=>[x.filter(r=>!r.oos).length,x.filter(r=>r.oos).length])),lim:T('Czysty tekst bez skanów i tabel, tylko jedna wersja archiwalna; realne instrukcje to PDF-y ze skanami i tabelami, często w kilku wersjach naraz'),proxy:T('Struktura odpowiada typowym opisom procesów, skala jest tysiąckrotnie mniejsza.')}});
const trMeta=()=>({
 vision:{ic:'eye',title:T('Wizyjna kontrola jakości'),inp:T('zdjęcie puszki z kamery na linii'),proc:T('wyliczenie cech obrazu i zastosowanie reguł decyzyjnych'),out:T('OK / wada'),
  methods:[[T('Reguły na cechach pikseli (to robicie w laboratorium)'),T('szybkie, wyjaśnialne, bez trenowania'),T('wrażliwe na oświetlenie i tło'),'≈ 0 $'],[T('Dostrojona sieć CNN'),T('odporna, uczy się z przykładów'),T('wymaga setek oznaczonych wad i GPU'),T('godziny GPU, rząd dziesiątek $')],[T('Model wizyjny przez API'),T('najszybszy PoC, bez trenowania'),T('koszt za wywołanie, opóźnienie, dane opuszczają zakład'),T('centy / 1000 zdjęć (zmierz w laboratorium)')]],data:T('data/vision/can_images (90 trening, 60 zestaw ćwiczeniowy, 60 test końcowy)')},
 rag:{ic:'message-square',title:T('Asystent wiedzy firmowej'),inp:T('pytanie pracownika w języku naturalnym'),proc:T('wyszukanie fragmentów opisów procesów i zbudowanie odpowiedzi ze źródłem'),out:T('odpowiedź + numer dokumentu i paragrafu'),
  methods:[[T('Szukanie po słowach (TF-IDF) i zdanie z dokumentu, bez modelu (to robicie w laboratorium)'),T('proste, tanie, przejrzyste'),T('nie rozumie synonimów; cytuje zdanie, nie pisze odpowiedzi'),'≈ 0 $'],[T('Szukanie po słowach (TF-IDF) i model językowy pisze odpowiedź – RAG (to robicie w laboratorium)'),T('pisze pełne odpowiedzi ze źródłem'),T('koszt tokenów; może zmyślić albo podać archiwalną procedurę, jeśli nie pilnujemy źródeł'),T('ułamek centa / 100 pytań (zmierz w laboratorium)')],[T('Douczanie modelu na dokumentach (nie do uruchomienia w laboratorium)'),T('styl odpowiedzi „po firmowemu”'),T('trudne w aktualizacji, drogie, brak cytowania'),T('wysoki')]],data:`docs/ (${DOCS.length})`},
 complaints:{ic:'mail',title:T('Analiza reklamacji'),inp:T('treść zgłoszenia klienta'),proc:T('klasyfikacja kategorii i przygotowanie projektu odpowiedzi'),out:T('kategoria + projekt odpowiedzi'),
  methods:[[T('Słowa kluczowe (to robicie w laboratorium)'),T('szybkie, wyjaśnialne'),T('kruche przy złożonych zgłoszeniach'),'≈ 0 $'],[T('Model językowy z promptem','LLM with a prompt'),T('radzi sobie ze złożonym językiem, pisze odpowiedzi'),T('koszt, konieczna weryfikacja przez człowieka'),T('ułamek centa / 100 zgłoszeń (zmierz w laboratorium)')],[T('Własny model trenowany przez informatyków (nie do uruchomienia w laboratorium)'),T('tani w użyciu po wytrenowaniu'),T('wymaga setek zgłoszeń z nadaną kategorią'),T('dni pracy specjalisty')]],data:'data/complaints.csv'},
 forecast:{ic:'trending-up',title:T('Prognozowanie popytu'),inp:T('historia sprzedaży produktu (miesięczna)'),proc:T('dopasowanie trendu i sezonowości'),out:T('prognoza na kolejne miesiące'),
  methods:[[T('Średnia / naiwna / sezonowa (metoda odniesienia)'),T('trywialne, trudne do pobicia'),T('ignoruje trend'),'0 $'],[T('Trend × sezonowość (to robicie w laboratorium)'),T('przejrzyste, dobre przy krótkich szeregach'),T('nie uwzględnia promocji'),'≈ 0 $'],[T('Model ML / uczenie głębokie'),T('może łączyć wiele zmiennych (ceny, pogoda)'),T('3 lata danych to za mało'),T('niski–średni')]],data:'data/sales_history.csv'},
 maint:{ic:'cog',title:T('Przewidywanie awarii maszyn'),inp:T('odczyty czujników: temperatura, ciśnienie, drgania'),proc:T('porównanie odczytów z tym, jak maszyna zwykle pracuje'),out:T('alarm anomalii'),
  methods:[[T('Stały próg (metoda odniesienia z PROCES-05)'),T('proste, znane operatorom'),T('ślepe na awarie innych sygnałów'),'0 $'],[T('Próg czułości na kilku czujnikach (to robicie w laboratorium)'),T('patrzy na kilka czujników naraz; zapis, kiedy były awarie, służy tu tylko do tego, żeby nie liczyć ich do normy'),T('wrażliwe na dobór progu'),'≈ 0 $'],[T('Model uczenia maszynowego (program sam uczy się wzorców; np. Isolation Forest, autoenkoder)'),T('wykrywa złożone wzorce w wielu czujnikach'),T('mało zdarzeń do nauki, trudniejsza interpretacja'),T('niski')]],data:'data/sensors.csv'}});
const STOP=new Set('jak co czy ile jest to w na z i a do po się nie jaki jaka jakie przy ciągu the of how what is are to in for and be or when which should does do at must within'.split(' '));
const toks=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(' ').filter(w=>w&&!STOP.has(w)).map(w=>w.slice(0,5));
const KW={damage:'wgniec, uszkodz, przecie, wybrzusz, rdze, ścieśni',label:'etykiet, kod, partii, składu',quality:'suchy, ości, słon, konsystenc, rozpada, smak',delivery:'zamówieni, dostaw, kurier, faktur, palet',smell:'zapach, śmierdz, nieświeży, zepsut'};
const SAFETY_KW='wybrzusz, wypukł, napuch, syknęł, zatruc, zapach, smród, śmierdz, zepsu, nieświeży, kwaśn, mętn, posmak';
const REPLY=c=>({damage:T('Dziękujemy za zgłoszenie. Przepraszamy za uszkodzenie produktu. Prosimy o zachowanie puszki i zdjęcie z numerem partii. Zaproponujemy zwrot pieniędzy lub wymianę.'),
 label:T('Dziękujemy za informację o problemie z etykietą. Przekazaliśmy sprawę do działu jakości i prosimy o numer partii, jeśli jest widoczny. Zaproponujemy wymianę produktu.'),
 quality:T('Dziękujemy za opinię o jakości produktu. Prosimy o numer partii i zdjęcie zawartości. Po analizie zaproponujemy zwrot lub wymianę.'),
 delivery:T('Dziękujemy za zgłoszenie. Sprawdzamy status zamówienia z działem logistyki i wrócimy z odpowiedzią w ciągu 14 dni. Prosimy o numer zamówienia.'),
 smell:T('Dziękujemy za zgłoszenie. Prosimy nie spożywać produktu i zachować puszkę wraz z numerem partii. Sprawa trafia do działu jakości w ciągu 24 godzin jako potencjalne zagrożenie bezpieczeństwa żywności.'),other:T('Dziękujemy za zgłoszenie. Przekazaliśmy je do właściwego działu.')})[c];
const LANES=()=>[
 ['src',T('Źródła danych'),[['cam',T('Kamera na linii')],['erp',T('ERP / historia sprzedaży')],['plc',T('PLC / czujniki')],['doc',T('Opisy procesów')],['mail',T('Skrzynka reklamacji / CRM')]]],
 ['prep',T('Przygotowanie danych'),[['clean',T('Czyszczenie i oznaczanie')],['anon',T('Anonimizacja danych osobowych')],['img',T('Skalowanie i augmentacja obrazów')],['chunk',T('Podział na fragmenty + embeddingi')],['feat',T('Cechy / okna czasowe')],['split',T('Podział train/test')]]],
 ['model',T('Model / metoda'),[['rules',T('Reguły (metoda odniesienia)')],['cv',T('Klasyczna wizja (OpenCV)')],['cnn',T('Sieć wizyjna (CNN)')],['llm',T('Model językowy (API)')],['rag',T('RAG')],['ts',T('Szeregi czasowe')],['anom',T('Wykrywanie anomalii')]]],
 ['store',T('Przechowywanie'),[['files',T('Pliki / data lake')],['sql',T('Baza SQL')],['vec',T('Baza wektorowa')],['reg',T('Rejestr modeli i logów')]]],
 ['ui',T('Interfejs'),[['dash',T('Panel operatora')],['chat',T('Czat')],['form',T('Formularz web')],['alert',T('Alert e-mail / Slack')],['rep',T('Raport PDF')]]],
 ['int',T('Integracje i utrzymanie'),[['mes',T('Integracja ERP / MES')],['mon',T('Monitoring jakości i dryfu')],['hitl',T('Weryfikacja przez człowieka')],['acl',T('Uprawnienia i audyt')]]]];
const PRESET={vision:['cam','clean','img','split','cv','rules','files','reg','dash','alert','mon','hitl'],rag:['doc','chunk','rag','llm','vec','chat','acl','mon'],complaints:['mail','clean','split','llm','rules','sql','form','rep','hitl','acl'],forecast:['erp','clean','feat','split','ts','rules','sql','dash','rep','mes','mon'],maint:['plc','feat','split','anom','rules','sql','reg','dash','alert','mes','mon']};
// A template replaces the diagram but keeps the safeguards a team added itself (often from a go-live warning's fix button).
const TPL_KEEP=['anon','hitl'];
// The vision template follows the chosen method: with the vision model via API, the model block replaces classical vision and rules.
// The template follows the method ticked in the lab; complaints always keep personal-data anonymisation (Marek Lis, GDPR).
function presetFor(k){const p=PRESET[k]||[],t=team(),cm=t.track===k?chosenMode(t,k):null;if(k==='vision'&&cm==='llm')return[...p.filter(x=>x!=='cv'&&x!=='rules'),'llm'];
 if(k==='complaints')return[...(cm==='rules'?p.filter(x=>x!=='llm'):p),'anon'];return p}
const INFRA=['local','cloud','hybrid'];
const METHOD_COLORS={mean:[INK3,'2 3'],naive:[BERRY,'8 3 2 3'],snaive:[GRAPE,'5 3'],ma:[GREEN,'3 2'],ts:[BLUE,'']};
// Model calls go through the class Worker (worker/), which holds the OpenRouter key. ?ai=<url> overrides it for testing.
const AI_DEFAULT_URL='https://rybex-ai.andrzey-jankowski.workers.dev';
// ?ai= is for local testing only: a link must not be able to send the saved class code to another server.
const AI_URL=(()=>{try{const q=new URLSearchParams(location.search).get('ai');if(q&&/^(localhost|127\.0\.0\.1)$/.test(new URL(q).hostname))return q.replace(/\/+$/,'')}catch(e){}return AI_DEFAULT_URL})();
const AI_MODELS={deepseek:{id:'deepseek/deepseek-v4.1-flash',name:'DeepSeek V4.1 Flash',pin:.045,pout:.5},haiku:{id:'anthropic/claude-haiku-5.5',name:'Claude Haiku 5.5',pin:.1,pout:.5}};
const AI_TRACKS=['vision','rag','complaints'],AI_CONCURRENCY=4,AI_TIMEOUT_MS=45000,AI_RETRY_MS=1500,AI_MAX_FAIL=.2;
// Complaints few-shot: examples come from complaints 1–20; with examples the model is scored on 21–36 only.
const SHOTS=[0,2,5,10,20],POOL_N=20,MAX_RUNS=40,KEEP_REPLIES=3;
// Vision: labelled training images in the prompt (0, one or two per class); the Worker accepts up to 10 images per request.
const VSHOTS=[0,4,8],MAX_VRUNS=10,KEEP_REASONS=2;

