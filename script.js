// VARIABILI GLOBALI
let partecipanti = {}; // {nome: []} – salverà solo i nomi inseriti
const STORAGE_KEY_NOMI = 'televotoNomiOnline';

// **!!! DEVI INCOLLARE QUI L'URL API DI SHEETDB.IO !!!**
// Questo URL è usato per LEGGERE i dati dal tuo Foglio Google.
const SHEETDB_API_URL_READ = 'https://sheetdb.io/api/v1/modve7uqqwetx'; 
// Esempio: 'https://sheetdb.io/api/v1/a1b2c3d4e5f6g7h8i9j0'

// --- FUNZIONI DI BASE ---

// 1. Carica la lista dei nomi dal localStorage
function caricaPartecipanti() {
    const nomiSalvati = localStorage.getItem(STORAGE_KEY_NOMI);
    if (nomiSalvati) {
        let nomi = JSON.parse(nomiSalvati);
        nomi.forEach(nome => partecipanti[nome] = []); // Inizializza solo la lista dei nomi
    }
    aggiornaInterfaccia();
}

// 2. Salva solo la lista dei nomi nel localStorage
function salvaNomi() {
    const nomiArray = Object.keys(partecipanti);
    localStorage.setItem(STORAGE_KEY_NOMI, JSON.stringify(nomiArray));
}

// 3. Aggiunge un nuovo partecipante
function aggiungiPartecipante() {
    const nomeInput = document.getElementById('nomeInput');
    const nome = nomeInput.value.trim();

    if (nome && !partecipanti[nome]) {
        partecipanti[nome] = [];
        salvaNomi();
        aggiornaInterfaccia();
        nomeInput.value = '';
    } else if (partecipanti[nome]) {
        alert('Nome già presente!');
    }
}

// 4. Aggiorna l'interfaccia utente
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';
    const baseUrl = window.location.href.split('?')[0].split('index.html')[0]; // Ottiene l'URL base di Netlify
    
    // Controlla se l'URL è pubblico (cioè NON localhost)
    const isLocal = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    
    if (isLocal) {
        listaDiv.innerHTML = `<p style="color:red;">**Attenzione:** Questa pagina deve essere pubblicata su Netlify/Vercel per funzionare correttamente. URL generato per QR Code è provvisorio.</p>`;
    }

    for (const nome in partecipanti) {
        const div = document.createElement('div');
        div.className = 'partecipante';
        div.innerHTML = `
            <strong>${nome}</strong> 
            <div class="qr-container">
                <canvas id="qr-${nome.replace(/\s/g, '_')}"></canvas>
                <p>Scansiona per votare ${nome}</p>
            </div>
            <button onclick="rimuoviPartecipante('${nome}')">Rimuovi</button>
        `;
        listaDiv.appendChild(div);
        
        // Genera il QR Code con l'URL pubblico di voto (voto.html)
        const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}`;
        
        new QRious({
            element: document.getElementById(`qr-${nome.replace(/\s/g, '_')}`),
            value: urlVoto,
            size: 150
        });
    }
}

// 5. Calcola la somma dei voti e salva
async function calcolaSommaETutto() {
    alert('Avvio del calcolo. Voti in fase di scaricamento dal Foglio Google...');
    
    try {
        // 5a. Scarica tutti i voti dal Foglio Google
        const response = await fetch(SHEETDB_API_URL_READ);
        if (!response.ok) {
            throw new Error(`Errore HTTP ${response.status}. Controlla che l'URL API sia corretto.`);
        }
        
        const allVoti = await response.json(); // Array di oggetti {nome: "X", voto: "Y"}
        
        // 5b. Raggruppa i voti per partecipante
        let risultatiSomma = {};
        let conteggioVoti = {};
        
        // Inizializza i partecipanti noti con punteggio zero
        for (const nome of Object.keys(partecipanti)) {
            risultatiSomma[nome] = 0;
            conteggioVoti[nome] = 0;
        }

        // Calcola la somma
        allVoti.forEach(record => {
            const nome = record.nome;
            // Assicura che i voti siano trattati come numeri
            const voto = parseInt(record.voto); 
            
            if (risultatiSomma.hasOwnProperty(nome) && !isNaN(voto)) {
                // Calcola la somma totale (accumulo)
                risultatiSomma[nome] += voto;
                conteggioVoti[nome]++;
            }
        });
        
        // 5c. Salva i totali (senza visualizzarli)
        localStorage.setItem('televotoTotali', JSON.stringify(risultatiSomma));
        
        // Aggiorna l'interfaccia con i conteggi (per feedback)
        aggiornaInterfaccia();
        
        alert(`Somma dei voti calcolata e salvata localmente per i nomi inseriti. Totale record scaricati: ${allVoti.length}`);

    } catch (error) {
        console.error("Errore nel calcolo o nel recupero dei dati:", error);
        alert(`ERRORE: Impossibile recuperare i voti. Controlla la console del browser per i dettagli.`);
    }
}

// 6. Visualizza la classifica (come prima)
function visualizzaClassifica() {
    const totaliSalvati = localStorage.getItem('televotoTotali');
    if (!totaliSalvati) {
        alert('Devi prima cliccare su "Calcola Somma Voti per Tutti"!');
        return;
    }

    const totali = JSON.parse(totaliSalvati);
    
    const classificaArray = Object.entries(totali)
        .sort(([, totaleA], [, totaleB]) => totaleB - totaleA);

    const listaClassifica = document.getElementById('listaClassifica');
    listaClassifica.innerHTML = '';

    classificaArray.forEach(([nome, totale], index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${nome}: ${totale} punti`;
        listaClassifica.appendChild(li);
    });

    document.getElementById('classifica').style.display = 'block';
}

function rimuoviPartecipante(nome) {
    if (confirm(`Sei sicuro di voler rimuovere ${nome}? Voti già presenti nel database rimarranno, ma non verranno contati.`)) {
        delete partecipanti[nome];
        salvaNomi();
        aggiornaInterfaccia();
    }
}