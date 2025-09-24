const ServerController = require("../controllers/serverController");
const logger = require("../utils/logger");

class ServerManager {
  constructor(io, serverId = 1) {
    this.io = io;
    this.serverId = serverId;
    this.isRunning = false;
    this.updateInterval = null;
    this.setupComplete = false;
    // 🔹 Manter lista de jogadores autenticados
    this.authenticatedPlayers = new Set();
    this.playersInGame = new Set(); // Jogadores que entraram no mundo
  }

  // Iniciar monitoramento do servidor
  start() {
    if (this.isRunning) {
      logger.warn("ServerManager já está rodando");
      return;
    }

    this.isRunning = true;
    logger.info(`Iniciando monitoramento do servidor ${this.serverId}`);

    // Configurar listeners apenas uma vez
    if (!this.setupComplete) {
      this.setupSocketListeners();
      this.setupComplete = true;
    }

    // Atualizar status do servidor a cada 30 segundos
    this.updateInterval = setInterval(() => {
      this.updateServerStatus();
    }, 30000);

    // Atualizar status inicial
    this.updateServerStatus();
  }

  // Parar monitoramento do servidor
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info(`Parando monitoramento do servidor ${this.serverId}`);

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Configurar listeners para eventos de socket
  setupSocketListeners() {
    logger.info(`Configurando listeners. Clientes atuais: ${this.getCurrentPlayerCount()}`);

    this.io.on("connection", (socket) => {
      logger.info(`Cliente conectado: ${socket.id}`);

      // 🔹 Adicionar à lista quando fizer login
      socket.on('login_success', () => {
        this.authenticatedPlayers.add(socket.id);
        logger.info(`Jogador autenticado: ${socket.id}. Total autenticados: ${this.authenticatedPlayers.size}`);
      });

      // 🔹 Adicionar à lista quando entrar no mundo
      socket.on('entered_world', () => {
        this.playersInGame.add(socket.id);
        logger.info(`Jogador entrou no mundo: ${socket.id}. Total no jogo: ${this.playersInGame.size}`);
      });

      socket.on("disconnect", (reason) => {
        // Remover da lista de autenticados e do jogo
        this.authenticatedPlayers.delete(socket.id);
        this.playersInGame.delete(socket.id);
        
        const currentCount = this.getCurrentPlayerCount();
        logger.info(`Jogador desconectado: ${socket.id} (${reason}). Total: ${currentCount}`);
      });
    });
  }

  // 🔹 Método para notificar que um jogador fez login
  playerAuthenticated(socketId) {
    this.authenticatedPlayers.add(socketId);
    logger.info(`Jogador autenticado: ${socketId}. Total: ${this.authenticatedPlayers.size}`);
  }

  // 🔹 Método para notificar que um jogador entrou no mundo
  playerEnteredWorld(socketId) {
    this.playersInGame.add(socketId);
    logger.info(`Jogador entrou no mundo: ${socketId}. Total no mundo: ${this.playersInGame.size}`);
  }

  // 🔹 Método para notificar que um jogador saiu do mundo
  playerLeftWorld(socketId) {
    this.playersInGame.delete(socketId);
    logger.info(`Jogador saiu do mundo: ${socketId}. Total no mundo: ${this.playersInGame.size}`);
  }

  // Atualizar status do servidor no banco de dados
  async updateServerStatus() {
    try {
      const currentPlayerCount = this.getCurrentPlayerCount();
      await ServerController.updateServerStatus(this.serverId, "online", currentPlayerCount);
      
      logger.info(`Status do servidor ${this.serverId} atualizado: ${currentPlayerCount} jogadores`);
    } catch (error) {
      logger.error("Erro ao atualizar status do servidor:", error.message);
    }
  }

  // 🔹 CORRIGIDO: Contar apenas jogadores que entraram no mundo
  getCurrentPlayerCount() {
    try {
      return this.playersInGame.size;
    } catch (error) {
      logger.error("Erro ao obter contagem de jogadores:", error.message);
      return 0;
    }
  }

  // 🔹 Contar jogadores autenticados (logados mas não necessariamente no jogo)
  getAuthenticatedPlayerCount() {
    return this.authenticatedPlayers.size;
  }

  // Verificar se o servidor está ativo
  isActive() {
    return this.isRunning;
  }

  // Método para debug
  listConnectedSockets() {
    try {
      const allSockets = Array.from(this.io.of("/").sockets.keys());
      const authenticated = Array.from(this.authenticatedPlayers);
      const inGame = Array.from(this.playersInGame);
      
      logger.info(`Total sockets: ${allSockets.length}`);
      logger.info(`Autenticados: ${authenticated.length}`);
      logger.info(`No jogo: ${inGame.length}`);
      
      return { allSockets, authenticated, inGame };
    } catch (error) {
      logger.error("Erro ao listar sockets:", error.message);
      return { allSockets: [], authenticated: [], inGame: [] };
    }
  }
}

module.exports = ServerManager;