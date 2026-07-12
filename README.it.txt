Controlla i tuoi climatizzatori ConnectLife da Homey.

ConnectLife è la piattaforma cloud usata dai climatizzatori Hisense, Gorenje, ASKO, ATAG ed ETNA (l'app ConnectLife). Questa app collega Homey a quel cloud, così puoi controllare i condizionatori e usarli nei Flow.

FUNZIONI
- Accensione/spegnimento
- Temperatura impostata (16-32 C)
- Modalità: raffreddamento, riscaldamento, deumidificazione, solo ventola, automatico
- Velocità ventola: automatica, bassa, medio-bassa, media, medio-alta, alta
- Oscillazione verticale on/off
- Temperatura ambiente (interna)
- Flow card: trigger, condizioni e azioni per modalità, velocità ventola e oscillazione

COME FUNZIONA
Aggiungi un dispositivo, scegli ConnectLife e accedi con il tuo account ConnectLife (stesso nome utente e password dell'app ConnectLife). I climatizzatori vengono rilevati automaticamente. Viene salvato solo il refresh token dell'account, mai la password.

L'app comunica con il cloud ConnectLife, che non invia aggiornamenti in tempo reale e mal tollera i poll frequenti: lo stato si aggiorna quindi dopo ogni comando. Per rilevare i cambi fatti dal telecomando o dall'app ConnectLife, usa l'azione Flow "Aggiorna stato dal cloud" oppure attiva un intervallo di aggiornamento lungo nelle impostazioni del dispositivo (disattivato di default).

NON UFFICIALE
App sviluppata dalla community. Non è affiliata, autorizzata o approvata da ConnectLife, Hisense, Gorenje, ASKO, ATAG o ETNA. Tutti i marchi appartengono ai rispettivi proprietari.

Open source (GPL-3.0-or-later): https://github.com/Ancelo/com.connectlife
È un port della libreria Python GPLv3 github.com/oyvindwe/connectlife, basata su github.com/bilan/connectlife-api-connector.
