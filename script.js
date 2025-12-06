// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';

// Variabile booleana per la modalità test
const IS_TEST_MODE = false; 

// Variabile per l'ID di sessione
const SESSION_ID = Date.now(); 
const STORAGE_KEY_VISITED = 'televotoVisitedQr'; 
let votiCorrenti = {}; 

// NUOVE VARIABILI PER LA GESTIONE DELL'ANIMAZIONE
let classificaFinale = []; // Contiene i gruppi di partecipanti ordinati
let indiceClassificaCorrente = 0;
let keyListener; // Variabile per tenere traccia del listener 'Enter'

// NOTE: db e VOTI_COLLECTION sono resi globali in firebase_init.js

// --- FUNZIONI DI UTILITÀ ---

function capitalizeWords(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Funzione per scaricare i voti e aggiornare la mappa votiCorrenti (UTILIZZA FIREBASE)
async function caricaConteggiVoti() {
    // Si assicura che db sia pronto, altrimenti esce
    if (!window.db) return; 

    try {
        const snapshot = await window.db.collection(window.VOTI_COLLECTION).get();
        
        const conteggi = {};
        
        for (const nome of Object.keys(partecipanti)) {
            conteggi[nome] = 0;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const nome = data.nome;
            if (conteggi.hasOwnProperty(nome)) {
                conteggi[nome] += 1;
            }
        });

        votiCorrenti = conteggi;
        aggiornaInterfaccia(); 

    } catch (error) {
        console.error("Impossibile caricare i conteggi dei voti da Firebase:", error);
    }
}

// 1. Carica la lista dei nomi dal localStorage
function caricaPartecipanti() {
    const nomiSalvati = localStorage.getItem(STORAGE_KEY_NOMI);
    if (nomiSalvati) {
        let nomi = JSON.parse(nomiSalvati);
        nomi.forEach(nome => partecipanti[nome] = []);
    }
    aggiornaInterfaccia();
}

// 2. Salva solo la lista dei nomi nel localStorage
function salvaNomi() {
    const nomiArray = Object.keys(partecipanti);
    localStorage.setItem(STORAGE_KEY_NOMI, JSON.stringify(nomiArray));
}

// 3. Aggiunge un nuovo partecipante dalla modale
function aggiungiPartecipante(nome) {
    const nomeCapitalizzato = capitalizeWords(nome.trim());

    if (!nomeCapitalizzato) {
        alert("Inserisci un nome valido.");
        return false;
    }
    
    if (nomeCapitalizzato && !partecipanti[nomeCapitalizzato]) {
        partecipanti[nomeCapitalizzato] = [];
        salvaNomi();
        votiCorrenti[nomeCapitalizzato] = 0; 
        aggiornaInterfaccia();
        return true;
    } else if (partecipanti[nomeCapitalizzato]) {
        alert('Nome già presente!');
        return false;
    }
}

// 4. Aggiorna l'interfaccia utente
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';
    
    const visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');

    for (const nome in partecipanti) {
        const conteggio = votiCorrenti[nome] || 0; 
        
        const card = document.createElement('div');
        card.className = 'partecipante-card';
        card.setAttribute('data-nome', nome);
        card.onclick = () => apriModaleQr(nome);
        
        if (visited.includes(nome)) {
            card.classList.add('visited');
        }

        card.innerHTML = `
            <h3>${nome}</h3>
            <div class="partecipante-info">
                <span class="vote-count" style="color: white; font-weight: 600;">${conteggio} voti</span>
                <button class="remove-btn" onclick="event.stopPropagation(); apriModaleConfermaElimina('${nome}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listaDiv.appendChild(card);
    }
}

// --- GESTIONE MODALI ---

let enterListenerModal; 

function apriModaleInserimento() {
    const inputField = document.getElementById('modalNomeInput');
    const modal = document.getElementById('inputModal');
    
    inputField.value = '';
    
    modal.style.display = 'flex';
    inputField.focus(); 
    
    if (enterListenerModal) {
        inputField.removeEventListener('keydown', enterListenerModal);
    }
    
    enterListenerModal = function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            salvaNomeDaModale();
        }
    };
    inputField.addEventListener('keydown', enterListenerModal);
}

function salvaNomeDaModale() {
    const nome = document.getElementById('modalNomeInput').value;
    const inputField = document.getElementById('modalNomeInput');
    
    if (aggiungiPartecipante(nome)) {
        document.getElementById('inputModal').style.display = 'none';
        inputField.removeEventListener('keydown', enterListenerModal);
    }
}

function apriModaleQr(nome) {
    const modal = document.getElementById('qrModal');
    const modalNome = document.getElementById('modalNomeQr');
    const qrCanvas = document.getElementById('modalQrCanvas');
    
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    if (!visited.includes(nome)) {
        visited.push(nome);
        localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited));
        const card = document.querySelector(`.partecipante-card[data-nome='${nome}']`);
        if (card) card.classList.add('visited');
    }

    const baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, ''); 

    const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}&session=${SESSION_ID}&test=${IS_TEST_MODE}`;

    modalNome.textContent = nome;

    new QRious({
        element: qrCanvas,
        value: urlVoto,
        size: 300,
        padding: 10
    });

    modal.style.display = 'flex';
}

function chiudiModale(event, id) {
    const modal = document.getElementById(id);
    if (event.target === modal) {
        modal.style.display = 'none';
        
        if (id === 'inputModal') {
            const inputField = document.getElementById('modalNomeInput');
            if (enterListenerModal) {
                 inputField.removeEventListener('keydown', enterListenerModal);
            }
        }
    }
}

function apriModaleConfermaElimina(nome) {
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Questo non cancella i voti passati dal database, ma non li conteggerà.`)) {
        rimuoviPartecipante(nome);
    }
}

function rimuoviPartecipante(nome) {
    delete partecipanti[nome];
    delete votiCorrenti[nome]; 
    salvaNomi();
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY_VISITED) || '[]');
    localStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(visited.filter(n => n !== nome)));
    aggiornaInterfaccia();
}

// --- FUNZIONI DI CALCOLO E CLASSIFICA (UTILIZZA FIREBASE) ---

async function calcolaMediaEVaiAllaClassifica() {
    if (!window.db) {
        alert("Il database non è stato ancora inizializzato. Attendi un istante e riprova. Se l'errore persiste, ricarica la pagina.");
        return;
    }
    
    document.body.style.cursor = 'wait';
    
    try {
        const colRef = window.db.collection(window.VOTI_COLLECTION);
        const snapshot = await colRef.get();
        
        let votiRaw = {}; 
        
        for (const nome of Object.keys(partecipanti)) {
            votiRaw[nome] = [];
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const nome = data.nome;
            const voto = parseInt(data.voto); 
            
            if (votiRaw.hasOwnProperty(nome) && !isNaN(voto)) {
                votiRaw[nome].push(voto);
            }
        });

        // 1. Calcola la media per ogni partecipante
        let risultatiMedia = {};
        for (const nome in votiRaw) {
            const voti = votiRaw[nome];
            const totaleVoti = voti.length;
            
            if (totaleVoti > 0) {
                const somma = voti.reduce((acc, voto) => acc + voto, 0);
                risultatiMedia[nome] = parseFloat((somma / totaleVoti).toFixed(2));
            } else {
                risultatiMedia[nome] = 0;
            }
        }
        
        // 2. Raggruppa i partecipanti per media (parimerito)
        const gruppiPerMedia = {};
        for (const nome in risultatiMedia) {
            const media = risultatiMedia[nome];
            if (!gruppiPerMedia[media]) {
                gruppiPerMedia[media] = [];
            }
            gruppiPerMedia[media].push(nome);
        }

        // 3. Ordina le medie e crea la classifica finale (dalla media più alta a quella più bassa)
        const medieOrdinate = Object.keys(gruppiPerMedia)
            .map(media => parseFloat(media))
            .sort((a, b) => b - a);

        let rankCounter = 1;
        classificaFinale = [];
        
        medieOrdinate.forEach(media => {
            const nomi = gruppiPerMedia[media].sort(); // Ordina i nomi per coerenza
            classificaFinale.push({
                rank: rankCounter,
                media: media.toFixed(2),
                nomi: nomi
            });
            rankCounter += nomi.length;
        });

        // La classifica deve essere rivelata dall'ultimo al primo, quindi invertiamo l'array dei gruppi
        classificaFinale.reverse(); 

        // Resetta l'indice per l'animazione
        indiceClassificaCorrente = 0; 

        visualizzaClassificaAnimata();
        document.body.style.cursor = 'default';

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore nel calcolo o nel recupero dei dati da Firebase:", error);
        alert(`ERRORE: Impossibile calcolare la media e la classifica. Controlla i permessi e la connessione Firebase.`);
    }
}

function visualizzaClassificaAnimata() {
    const classificaView = document.getElementById('classifica-view');
    const mainView = document.getElementById('main-view');
    const classificaBtn = document.getElementById('classificaBtn');
    
    // 1. Nasconde la lista e i pulsanti (tranne il RESET)
    mainView.style.display = 'none';
    classificaBtn.style.display = 'none';
    classificaView.style.display = 'flex';
    
    // 2. Aggiunge il listener per il tasto Invio (solo se non è già attivo)
    if (!keyListener) {
        keyListener = function handleKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Previene il comportamento predefinito
                mostraProssimoElemento();
            }
        };
        document.addEventListener('keydown', keyListener);
    }
    
    // Mostra il primo elemento subito (l'ultimo in classifica)
    if (indiceClassificaCorrente === 0) {
        mostraProssimoElemento();
    }
}

function mostraProssimoElemento() {
    const listaClassifica = document.getElementById('listaClassifica');
    const classificaView = document.getElementById('classifica-view');

    if (indiceClassificaCorrente < classificaFinale.length) {
        const item = classificaFinale[indiceClassificaCorrente];
        
        // Costruzione del container
        const li = document.createElement('li');
        li.className = 'classifica-item';
        
        // Costruisce la lista di nomi per il parimerito
        const nomiHTML = item.nomi.map(nome => `<p>${nome}</p>`).join('');
        
        li.innerHTML = `
            <span class="rank">${item.rank}.</span>
            <div class="name-list">${nomiHTML}</div>
            <span class="avg">${item.media}</span>
        `;
        
        // Aggiunge il container in cima (grazie a flex-direction: column-reverse su #listaClassifica)
        listaClassifica.prepend(li); 
        
        // Attiva l'animazione di scorrimento dopo un piccolo ritardo per permettere al DOM di renderizzare
        setTimeout(() => {
            li.classList.add('slide-in');
            
            // Scorrimento: se la vista è piena, scorre in modo che l'ultimo elemento sia visibile
            if (listaClassifica.scrollHeight > classificaView.clientHeight) {
                // Scorri in alto per rendere visibile l'ultimo elemento aggiunto (che è in cima)
                classificaView.scrollTop = 0; 
            }
            
        }, 50); 
        
        indiceClassificaCorrente++;
        
    } else if (indiceClassificaCorrente === classificaFinale.length) {
        // Classifica completa
        alert('Classifica completata! Premi RESET per ricominciare.');
        // Rimuovi il listener una volta finita la classifica
        document.removeEventListener('keydown', keyListener);
        keyListener = null;
    }
}


// 7. FUNZIONE DI RESET COMPLETO (UTILIZZA FIREBASE)
async function resetCompleto() {
    if (!window.db) {
        alert("Il database non è inizializzato.");
        return;
    }

    if (!confirm("SEI SICURO? QUESTA È UN'OPERAZIONE DI ELIMINAZIONE PERMANENTE. I voti saranno cancellati da Firebase e la lista nomi azzerata.")) {
        return;
    }
    
    // Rimuove il listener prima di ricaricare la pagina
    if (keyListener) {
        document.removeEventListener('keydown', keyListener);
        keyListener = null;
    }

    document.body.style.cursor = 'wait';

    try {
        const colRef = window.db.collection(window.VOTI_COLLECTION);
        const snapshot = await colRef.get();
        
        const batch = window.db.batch();
        
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem(STORAGE_KEY_VISITED);
        
        alert("RESET COMPLETATO! Nuova sessione iniziata. I voti su Firebase sono stati cancellati.");
        location.reload(); 

    } catch (error) {
        document.body.style.cursor = 'default';
        console.error("Errore grave nel reset con Firebase:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Voti NON azzerati. Controlla la console.`);
    }
}
