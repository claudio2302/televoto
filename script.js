// VARIABILI GLOBALI
let partecipanti = {};
const STORAGE_KEY_NOMI = 'televotoNomiOnline';

// Variabile per l'ID di sessione, generata al caricamento della pagina per distinguere i voti
const SESSION_ID = Date.now(); 

// **!!! DEVI INCOLLARE QUI L'URL API DI SHEETDB.IO !!!**
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/modve7uqqwetx'; 

// --- FUNZIONI DI BASE ---

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

// 4. Aggiorna l'interfaccia utente (con ID di sessione)
function aggiornaInterfaccia() {
    const listaDiv = document.getElementById('listaPartecipanti');
    listaDiv.innerHTML = '';
    const baseUrl = window.location.href.split('?')[0].split('index.html')[0]; 
    const isLocal = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    
    if (isLocal) {
        listaDiv.innerHTML = `<p style="color:red;">**Attenzione:** Questa pagina deve essere pubblicata su Netlify/Vercel per funzionare correttamente.</p>`;
    }

    for (const nome in partecipanti) {
        const div = document.createElement('div');
        div.className = 'partecipante';
        div.innerHTML = `
            <strong>${nome}</strong> 
            <div class="qr-container">
                <canvas id="qr-${nome.replace(/\s/g, '_')}" title="Sessione: ${SESSION_ID}"></canvas>
                <p>Scansiona per votare ${nome}</p>
            </div>
            <button onclick="rimuoviPartecipante('${nome}')">Rimuovi</button>
        `;
        listaDiv.appendChild(div);
        
        // Genera il QR Code con l'ID di sessione dinamico
        const urlVoto = `${baseUrl}voto.html?nome=${encodeURIComponent(nome)}&session=${SESSION_ID}`;
        
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
        const response = await fetch(SHEETDB_API_URL); // SheetDB API READ (GET)
        if (!response.ok) {
            throw new Error(`Errore HTTP ${response.status}.`);
        }
        
        const allVoti = await response.json(); 
        let risultatiSomma = {};
        
        for (const nome of Object.keys(partecipanti)) {
            risultatiSomma[nome] = 0;
        }

        allVoti.forEach(record => {
            const nome = record.nome;
            const voto = parseInt(record.voto); 
            
            if (risultatiSomma.hasOwnProperty(nome) && !isNaN(voto)) {
                risultatiSomma[nome] += voto;
            }
        });
        
        localStorage.setItem('televotoTotali', JSON.stringify(risultatiSomma));
        
        alert(`Somma dei voti calcolata e salvata localmente. Totale record scaricati: ${allVoti.length}`);

    } catch (error) {
        console.error("Errore nel calcolo o nel recupero dei dati:", error);
        alert(`ERRORE: Impossibile recuperare i voti. Controlla la console.`);
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

// 7. FUNZIONE DI RESET COMPLETO (Novità)
async function resetCompleto() {
    if (!confirm("SEI SICURO? Questa operazione ELIMINERÀ TUTTI I VOTI dal Foglio Google e pulirà la lista dei nomi. NON è reversibile.")) {
        return;
    }

    // 7a. Cancella tutti i record dal Foglio Google (operazione di ELIMINA massiva)
    try {
        const deleteResponse = await fetch(`${SHEETDB_API_URL}/all`, {
            method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
            throw new Error(`Errore API DELETE: ${deleteResponse.status}`);
        }
        
        const result = await deleteResponse.json();
        if (result.deleted > 0) {
            console.log(`Eliminati ${result.deleted} record dal Foglio Google.`);
        } else {
             console.log(`Nessun record da eliminare, database già vuoto.`);
        }
        
        // 7b. Cancella i nomi dal localStorage
        localStorage.removeItem(STORAGE_KEY_NOMI);
        localStorage.removeItem('televotoTotali');
        
        alert("RESET COMPLETATO! Voti e lista nomi azzerati. La pagina verrà ricaricata per una nuova sessione.");
        location.reload();

    } catch (error) {
        console.error("Errore nel reset:", error);
        alert(`ERRORE GRAVE DURANTE IL RESET. Controlla la console. Voti NON azzerati: ${error.message}`);
    }
}
