// ============================
// VARIÁVEIS GLOBAIS
// ============================
var mapa;
var camadaPedidos;
var featuresData = []; // Armazena { feature, layer } para controle de filtro/lista

// ============================
// CONFIGURAÇÃO INICIAL DO MAPA
// ============================

// Centro inicial aproximado em Goiânia
mapa = L.map("mapa", { maxZoom: 20 }).setView([-16.681253, -49.256044], 12);

// Garante que o Leaflet recalcule o tamanho após o layout carregar
setTimeout(function () {
  mapa.invalidateSize();
}, 200);


// ---------- Camadas de fundo ----------

// OpenStreetMap padrão
var osm = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxNativeZoom: 19,
    maxZoom: 20, // permite manter zoom 20 sem “sumir”
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }
).addTo(mapa);

// Satélite (Esri) — nativo até 19
var sateliteImagem = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxNativeZoom: 19,
    maxZoom: 20, // mantém preenchido mesmo se o mapa estiver em 20
    attribution: "Tiles &copy; Esri"
  }
);

// Google Hybrid
var googleHybrid = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  {
    maxNativeZoom: 20,
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "© Google"
  }
);

// Grupo onde ficarão os pontos
camadaPedidos = L.layerGroup().addTo(mapa);

// Controle de camadas
var baseMaps = {
  "OpenStreetMap": osm,
  "Satélite (imagem)": sateliteImagem,
  "Google Hybrid": googleHybrid
};

var overlays = { "Pedidos de Licença": camadaPedidos };
var layersControl = L.control.layers(baseMaps, overlays, { collapsed: true }).addTo(mapa);

mapa.on("baselayerchange", function () {
  setTimeout(function () {
    mapa.invalidateSize();
  }, 50);
});

// ============================
// CAMADAS DE APOIO (VISUAIS)
// ============================

// Estilos conforme solicitado
var estiloBairros = {
  color: "#FFA500",   // cinza escuro
  weight: 2,
  opacity: 1
};


var estiloLimiteMunicipal = {
  color: "#000000",   // preto
  weight: 2.5,
  fill: false,
  opacity: 1
};

var estiloHidrografia = {
  color: "#7ecbff",   // azul claro
  weight: 1.5,
  fill: false,
  opacity: 1
};

// Helper para carregar GeoJSON como overlay e registrar no controle
function carregarOverlayGeoJSON(nomeCamada, urlGeojson, estilo, addPorPadrao) {
  return fetch(urlGeojson)
    .then(function (r) {
      if (!r.ok) throw new Error("Erro ao carregar: " + urlGeojson);
      return r.json();
    })
    .then(function (gj) {
      var layer = L.geoJSON(gj, { style: estilo });

      // Registra no controle para o usuário ativar/desativar
      layersControl.addOverlay(layer, nomeCamada);

      // Se quiser ligar por padrão
      if (addPorPadrao) layer.addTo(mapa);

      return layer;
    })
    .catch(function (err) {
      console.error("Falha na camada " + nomeCamada + ":", err);
      return null;
    });
}

// Carrega as camadas (todas começam DESLIGADAS por padrão)
carregarOverlayGeoJSON("Bairros", "dados/bairros.geojson", estiloBairros, false);
carregarOverlayGeoJSON("Limite Municipal", "dados/limite_municipal.geojson", estiloLimiteMunicipal, true);
carregarOverlayGeoJSON("Hidrografia", "dados/hidrografia.geojson", estiloHidrografia, true);

// Barra de escala no canto inferior esquerdo
L.control.scale({
  position: "bottomleft",
  metric: true,
  imperial: false
}).addTo(mapa);

// Rosa dos ventos (somente Norte) no canto superior direito
var northControl = L.control({ position: "bottomleft" });

northControl.onAdd = function (map) {
  var div = L.DomUtil.create("div", "north-arrow");
  div.innerHTML = "N";
  return div;
};

northControl.addTo(mapa);

// Indicador de coordenadas (abaixo do mapa)
var coordsEl = document.getElementById("coordenadas-mapa");

if (coordsEl) {
  mapa.on("mousemove", function (e) {
    var lat = e.latlng.lat.toFixed(6);
    var lng = e.latlng.lng.toFixed(6);
    coordsEl.textContent = "Lat: " + lat + " | Lon: " + lng;
  });

  mapa.on("mouseout", function () {
    coordsEl.textContent = "Passe o mouse sobre o mapa para ver as coordenadas";
  });
}

// ============================
// FUNÇÃO DE COR POR STATUS
// ============================

function corPorStatus(status) {
  if (!status) return "#808080";

  status = status.toLowerCase();

  if (status.includes("aprovado")) return "#2ecc71";          // verde
  if (status.includes("em análise")) return "#f1c40f";        // amarelo
  if (status.includes("pendente")) return "#e67e22";          // laranja
  if (status.includes("iniciar")) return "#3498db";           // azul

  return "#808080"; // padrão
}

// ============================
// ELEMENTOS DA INTERFACE
// ============================

var filtroStatusEl = document.getElementById("filtro-status");
var buscaProcessoEl = document.getElementById("busca-processo");
var listaLicencasEl = document.getElementById("lista-licencas");
var buscaEmpreendimentoEl = document.getElementById("busca-empreendimento");

// ============================
// CARREGAR GEOJSON
// ============================

fetch("dados/pedidos_licenca.geojson")
  .then(function (response) {
    if (!response.ok) {
      throw new Error("Erro ao carregar o GeoJSON");
    }
    return response.json();
  })
  .then(function (dados) {
    // Cria a camada GeoJSON
    var geojsonLayer = L.geoJSON(dados, {
      pointToLayer: function (feature, latlng) {
        var status = feature.properties.status || "";
        var cor = corPorStatus(status);

        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: cor,
          color: "#333",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.85
        });
      },
      onEachFeature: function (feature, layer) {
        var p = feature.properties || {};

        var processo = p.processo || "Não informado";
        var tipo = p.tipo || "Não informado";
        var emp = p.empreendimento || "Não informado";
        var finalidade = p.finalidade || "Não informada";
        var loc = p.localizacao || "Não informada";
        var validade = p.validade || "Não informado";
        var status = p.status || "Não informado";
        var validade = p.validade || "";
        var classeValPopup = classeValidade(validade);
        var textoValidade = validade || "Não informada";
        var pdfLicenca = p.pdf_licenca; // pode ser null
        var pdfParecer = p.pdf_parecer // pode ser null

        var htmlPopup = `
          <div>
            <div class="popup-titulo">${emp}</div>
            <div class="popup-valor"><span class="popup-label">Processo: </span>${processo}</div>
            <div class="popup-valor"><span class="popup-label">Tipo: </span>${tipo}</div>
            <div class="popup-valor"><span class="popup-label">Finalidade: </span>${finalidade}</div>
            <div class="popup-valor"><span class="popup-label">Localização: </span>${loc}</div>
            <div class="popup-valor"><span class="popup-label">Status: </span>${status}</div>
            <div class="popup-valor">
              <span class="popup-label">Validade: </span>${textoValidade}
            </div>
        `;

        if (pdfLicenca) {
          htmlPopup += `
            <div style="margin-top:6px;">
              <a href="${pdfLicenca}" download>📄 Baixar licença (PDF)</a>
            </div>
          `;
        }

         if (pdfParecer) {
           htmlPopup += `
            <div style="margin-top:6px;">
              <a href="${pdfParecer}" download>📝 Baixar Parecer Técnico (PDF)</a>
            </div>
          `;
       }

        htmlPopup += `</div>`;

        layer.bindPopup(htmlPopup);

        // Guarda a relação feature-layer para usar na lista e no filtro
        featuresData.push({
          feature: feature,
          layer: layer
        });
      }
    });

    geojsonLayer.addTo(camadaPedidos);

    try {
      mapa.fitBounds(geojsonLayer.getBounds());
    } catch (e) {
      console.warn("Não foi possível ajustar a extensão do mapa (talvez nenhum dado?).");
    }

    // Adiciona legenda
    adicionarLegenda();

    // Monta lista inicial
    atualizarMapaELista();

    // Após ajustar a extensão, recalcula de novo o tamanho do mapa
    setTimeout(function () {
      mapa.invalidateSize();
    }, 200);

  })
  .catch(function (error) {
    console.error(error);
  });

  // ============================
// FUNÇÕES AUXILIARES - VALIDADE
// ============================

// Espera data no formato "dd/mm/aaaa"
function parseDataBR(dataStr) {
  if (!dataStr) return null;
  var partes = dataStr.split("/");
  if (partes.length !== 3) return null;

  var dia = parseInt(partes[0], 10);
  var mes = parseInt(partes[1], 10) - 1; // mês 0-11
  var ano = parseInt(partes[2], 10);

  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;

  return new Date(ano, mes, dia);
}

// Retorna classe CSS conforme validade
function classeValidade(validadeStr) {
  var hoje = new Date();
  var dtVal = parseDataBR(validadeStr);

  if (!dtVal) {
    return "sem"; // sem data
  }

  // Zerar horas pra comparar só data
  hoje.setHours(0, 0, 0, 0);
  dtVal.setHours(0, 0, 0, 0);

  var difMs = dtVal - hoje;
  var difDias = difMs / (1000 * 60 * 60 * 24);

  if (difDias < 0) {
    return "expirada"; // já venceu
  } else if (difDias <= 90) {
    return "proxima"; // até 90 dias pra vencer
  } else {
    return "ok"; // validade tranquila
  }
}

// Remove pontos, traços, barras, espaços e deixa minúsculo
function normalizaTexto(t) {
  if (!t) return "";
  return t
    .toString()
    .toLowerCase()
    .replace(/[\.\-\/\s]/g, "");
}

// ============================
// FUNÇÃO: ATUALIZA MAPA E LISTA
// ============================

function atualizarMapaELista() {
  var statusSelecionado = filtroStatusEl ? filtroStatusEl.value : "todos";
  var termoBuscaBruto = buscaProcessoEl
    ? buscaProcessoEl.value.trim()
    : "";
  var termoBusca = normalizaTexto(termoBuscaBruto);
  var termoBuscaEmpBruto = buscaEmpreendimentoEl
    ? buscaEmpreendimentoEl.value.trim()
    : "";
  var termoBuscaEmp = normalizaTexto(termoBuscaEmpBruto);


  // Limpa a lista
  listaLicencasEl.innerHTML = "";

  // Remove todos os layers da camadaPedidos
  camadaPedidos.clearLayers();

  // Contadores (consideram SEMPRE o conjunto filtrado)
  var contAprovado = 0;
  var contEmAnalise = 0;
  var contPendente = 0;
  var contAIniciar = 0;

  featuresData.forEach(function (item, index) {
    var feature = item.feature;
    var layer = item.layer;
    var p = feature.properties || {};

    var status = (p.status || "").toString();
    var processo = (p.processo || "").toString();  // AGORA está aqui, antes do filtro!
    var processoNorm = normalizaTexto(processo);

    var emp = (p.empreendimento || "").toString();
    var empNorm = normalizaTexto(emp);


    // Verifica filtro
    var inclui = true;

    // 1) Status
    if (statusSelecionado !== "todos") {
      if (status.toLowerCase() !== statusSelecionado.toLowerCase()) {
        inclui = false;
      }
    }

    // 2) Busca por processo (só se o usuário digitou algo)
    if (inclui && termoBusca) {
      if (!processoNorm.includes(termoBusca)) {
        inclui = false;
      }
    }

    // 3) Busca por empreendimento
    if (inclui && termoBuscaEmp) {
      if (!empNorm.includes(termoBuscaEmp)) {
        inclui = false;
      }
    }


    if (inclui) {

       // Atualiza contadores de acordo com o status da feição incluída
      var statusNorm = status.toLowerCase();
      if (statusNorm.includes("aprov")) {
        contAprovado++;
      } else if (statusNorm.includes("em análise - SEFIC","em análise - AMMA", "em análise - SEMAD-GO") || statusNorm.includes("em análise - SEFIC","em análise - AMMA", "em análise - SEMAD-GO")) {
        contEmAnalise++;
      } else if (statusNorm.includes("iniciar")) {
        contAIniciar++;
      } else if (statusNorm.includes("pendente")) {
        contPendente++;
      }

      // Adiciona o layer (ponto) na camada
      camadaPedidos.addLayer(layer);

      // Cria item na lista
      var tipo = p.tipo || "Não informado";
      var emp = p.empreendimento || "Não informado";
      var validade = p.validade || ""; // campo do GeoJSON

      var classeVal = classeValidade(validade);
      var textoValidade = validade || "Não informada";

      var divItem = document.createElement("div");
      divItem.className = "item-licenca";
      divItem.innerHTML = `
        <div class="item-licenca-titulo">${emp}</div>
        <div class="item-licenca-processo">Processo: ${processo || "Não informado"}</div>
        <div class="item-licenca-tipo">Tipo: ${tipo}</div>
        <div class="item-licenca-status">Status: ${status || "Não informado"}</div>
        <div class="item-licenca-validade ${classeVal}">
          📅 Validade: ${textoValidade}
        </div>
      `;

      // Ao clicar no item da lista → centraliza no ponto e abre popup
      divItem.addEventListener("click", function () {
        if (layer.getLatLng) {
          var latlng = layer.getLatLng();
          mapa.setView(latlng, 16);
          layer.openPopup();
        }
      });

      listaLicencasEl.appendChild(divItem);
    }
  });

  // Se não tiver nenhum item, mostra uma mensagem
  if (!listaLicencasEl.hasChildNodes()) {
    var msg = document.createElement("div");
    msg.style.fontSize = "12px";
    msg.style.fontStyle = "italic";
    msg.style.color = "#666";
    msg.textContent = "Nenhum pedido encontrado para o filtro/busca selecionado.";
    listaLicencasEl.appendChild(msg);
  }

  // Atualiza contadores no topo (consideram o conjunto filtrado)
  var elAprovado = document.getElementById("contador-aprovado");
  var elEmAnalise = document.getElementById("contador-em-analise");
  var elAIniciar = document.getElementById("contador-a-iniciar");
  var elPendente = document.getElementById("contador-pendente");

  if (elAprovado)  elAprovado.textContent  = contAprovado;
  if (elEmAnalise) elEmAnalise.textContent = contEmAnalise;
  if (elAIniciar)  elAIniciar.textContent  = contAIniciar;
  if (elPendente) elPendente.textContent = contPendente;
}

// Evento de mudança no filtro de status ou por processo
if (filtroStatusEl) {
  filtroStatusEl.addEventListener("change", atualizarMapaELista);
}

if (buscaProcessoEl) {
  // Atualiza em tempo real enquanto digita
  buscaProcessoEl.addEventListener("input", atualizarMapaELista);
}

if (buscaEmpreendimentoEl) {
  buscaEmpreendimentoEl.addEventListener("input", atualizarMapaELista);
}

// ============================
// LEGENDA
// ============================

function adicionarLegenda() {
  var legenda = L.control({ position: "bottomright" });

  legenda.onAdd = function () {
    var div = L.DomUtil.create("div", "legenda");
    div.innerHTML = `
      <div><strong>Status das Licenças</strong></div>
      <div class="legenda-item">
        <span class="legenda-cor" style="background:#2ecc71;"></span> Aprovado
      </div>
      <div class="legenda-item">
        <span class="legenda-cor" style="background:#f1c40f;"></span> Em análise
      </div>
      <div class="legenda-item">
        <span class="legenda-cor" style="background:#e67e22;"></span> Pendente de documentação
      </div>
      <div class="legenda-item">
        <span class="legenda-cor" style="background:#3498db;"></span> A iniciar
      </div>
    `;
    return div;
  };

  legenda.addTo(mapa);

}
