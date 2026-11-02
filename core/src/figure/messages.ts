/**
 * Languages core can write in. Brazilian Portuguese is the source language:
 * operations return their messages in it, and figure text uses its decimal
 * comma unless the doc says otherwise.
 */
export type Locale = "pt-BR" | "en";

export const LOCALES: readonly Locale[] = ["pt-BR", "en"];

/**
 * English for the messages of the operations, the input parser and figure
 * files, keyed by the Portuguese text like a gettext catalog. A test checks
 * that every message in those files has an entry here.
 */
const EN: Record<string, string> = {
  // Shapes
  "Selecione ao menos dois pontos para ligar.": "Select at least two points to connect.",
  "Selecione ao menos três pontos para fechar um contorno.": "Select at least three points to close an outline.",
  "Esses pontos já estão ligados.": "These points are already connected.",
  "Selecione três pontos (A, B, C marca o ângulo em B) ou um polígono.":
    "Select three points (A, B, C marks the angle at B) or a polygon.",
  "Os pontos estão alinhados, não há ângulo para marcar.": "The points are collinear, so there is no angle to mark.",
  "Esses ângulos já existem.": "These angles already exist.",
  "Selecione ao menos três pontos, ou os segmentos de um contorno fechado.":
    "Select at least three points, or the segments of a closed outline.",
  "Selecione ao menos três segmentos que formem um contorno fechado.":
    "Select at least three segments that form a closed outline.",
  "Os segmentos devem formar um único contorno fechado.": "The segments must form a single closed outline.",
  "Os segmentos devem se ligar um a um, sem bifurcações nem pontas soltas.":
    "The segments must join one to one, with no branches or loose ends.",
  "Os segmentos selecionados se cruzam.": "The selected segments cross each other.",
  "Os pontos estão alinhados e não formam um polígono.": "The points are collinear and don't form a polygon.",
  "Esse polígono já existe.": "This polygon already exists.",
  "Selecione o ponto que será o centro.": "Select the point that will be the center.",
  "Selecione o centro e depois um ponto da circunferência.": "Select the center, then a point on the circle.",
  "Selecione o centro e um segmento para a circunferência tangenciar.":
    "Select the center and a segment for the circle to touch.",
  "Selecione três pontos por onde a circunferência passa.": "Select three points the circle goes through.",
  "Os três pontos estão alinhados, não há circunferência que passe por eles.":
    "The three points are collinear, so no circle goes through them.",
  "O raio ficou zero. Escolha outros pontos.": "The radius came out zero. Choose other points.",
  "Selecione um segmento.": "Select a segment.",
  "O ponto ficaria fora do segmento.": "The point would fall outside the segment.",
  "Escreva o texto.": "Write the text.",
  "As formas selecionadas já estão preenchidas.": "The selected shapes are already filled.",
  "Esse ponto não existe mais.": "That point no longer exists.",
  "Selecione segmentos, polígonos ou circunferências.": "Select segments, polygons or circles.",
  "Arcos ainda não viram funções: selecione circunferências inteiras.":
    "Arcs can't become functions yet: select whole circles.",

  // Labels
  "Não há elementos para etiquetar.": "There is nothing to label.",
  "Não há rótulos para apagar.": "There are no labels to remove.",
  "Marque o que rotular.": "Choose what to label.",

  // Constructions
  "Selecione um vértice e o lado oposto (um segmento ou dois pontos), ou um triângulo para traçar as três.":
    "Select a vertex and the opposite side (a segment or two points), or a triangle to draw all three.",
  "Selecione também o lado oposto: um segmento ou dois pontos.":
    "Also select the opposite side: a segment or two points.",
  "O ponto é vértice de mais de um triângulo. Selecione também o lado oposto.":
    "The point is a vertex of more than one triangle. Also select the opposite side.",
  "O vértice não pode ser uma ponta do lado oposto.": "The vertex can't be an end of the opposite side.",
  "As pontas do lado coincidem.": "The ends of the side are the same point.",
  "O vértice está sobre a reta do lado oposto.": "The vertex lies on the line of the opposite side.",
  "Selecione um segmento ou dois pontos.": "Select a segment or two points.",
  "Os dois pontos coincidem.": "The two points are the same point.",
  "Esse ponto médio já existe.": "This midpoint already exists.",
  "Essa altura já existe.": "This altitude already exists.",
  "Essas alturas já existem.": "These altitudes already exist.",
  "Selecione o ponto e um segmento, ou o ponto e depois dois pontos da reta.":
    "Select the point and a segment, or the point and then two points of the line.",
  "O ponto é uma ponta do segmento: ele já está sobre a reta.":
    "The point is an end of the segment, so it is already on the line.",
  "Os dois pontos da reta coincidem.": "The two points of the line are the same point.",
  "O ponto já está sobre a reta.": "The point is already on the line.",
  "Essa projeção já existe.": "This projection already exists.",
  "Essa mediana já existe.": "This median already exists.",
  "Essas medianas já existem.": "These medians already exist.",
  "Selecione um ângulo, três pontos (A, B, C traça a bissetriz em B) ou um triângulo.":
    "Select an angle, three points (A, B, C bisects the angle at B) or a triangle.",
  "Os pontos estão alinhados, não há ângulo para dividir.": "The points are collinear, so there is no angle to bisect.",
  "Essa bissetriz já existe.": "This bisector already exists.",
  "Essas bissetrizes já existem.": "These bisectors already exist.",
  "Essa mediatriz já existe.": "This perpendicular bisector already exists.",
  "Selecione uma mediatriz.": "Select a perpendicular bisector.",
  "A mediatriz não tem marca.": "The perpendicular bisector has no mark.",
  "A mediatriz já tem marca.": "The perpendicular bisector already has a mark.",
  "O comprimento precisa ser maior que zero.": "The length must be greater than zero.",
  "Selecione um ponto sobre um gráfico, ou clique com o botão direito na curva.":
    "Select a point on a graph, or right-click the curve.",
  "O gráfico não tem reta tangente nesse ponto, como num bico.":
    "The graph has no tangent line at that point, as at a corner.",
  "Essa reta tangente já existe.": "This tangent line already exists.",
  "Selecione uma reta tangente.": "Select a tangent line.",
  "A reta tangente só preenche a janela dos eixos.": "A tangent line can only fill the axes window.",
  "Selecione um arco de circunferência.": "Select a circular arc.",
  "Esse arco não tem raios.": "This arc has no radii.",
  "Esse setor já tem raios.": "This sector already has radii.",
  "Selecione uma circunferência.": "Select a circle.",
  "Selecione dois objetos que se cruzem: segmentos, circunferências, gráficos ou retas verticais.":
    "Select two objects that cross: segments, circles, graphs or vertical lines.",
  "Os objetos selecionados não se cruzam.": "The selected objects don't cross.",
  "Os objetos já se cruzam em pontos da figura.": "The objects already cross at points of the figure.",
  "Já há um ponto aí.": "There is already a point there.",
  "Os pontos selecionados já são livres.": "The selected points are already free.",

  // Graphs
  "Selecione um gráfico.": "Select a graph.",
  "Selecione os eixos.": "Select the axes.",
  "Selecione pontos.": "Select points.",
  "A figura já tem eixos.": "The figure already has axes.",
  "A figura já tem uma malha.": "The figure already has a grid.",
  "A figura não tem eixos. Insira eixos antes: Gráficos › Eixos.":
    "The figure has no axes. Insert axes first: Gráficos › Eixos.",
  "Crie uma reta numérica antes: Gráficos › Reta numérica.": "Create a number line first: Gráficos › Reta numérica.",
  "O início do intervalo precisa ser menor que o fim.": "The interval must start before it ends.",
  "O início precisa ser menor que o fim.": "The start must be less than the end.",
  "O início só pode ser -∞.": "Only the start can be -∞.",
  "O fim só pode ser +∞.": "Only the end can be +∞.",
  "Valor de x fora do limite.": "The x value is out of range.",
  "Valor fora do limite da figura.": "The value is outside the figure's limits.",
  "O ponto fica fora do limite da figura.": "The point falls outside the figure's limits.",
  "As raízes já estão marcadas.": "The roots are already marked.",
  "Os máximos e mínimos já estão marcados.": "The maxima and minima are already marked.",
  "O corte no eixo y já está marcado.": "The y-intercept is already marked.",
  "O gráfico não tem raízes na parte desenhada.": "The graph has no roots in the drawn part.",
  "O gráfico não tem máximos nem mínimos na parte desenhada.": "The graph has no maxima or minima in the drawn part.",
  "O gráfico não cruza o eixo y na parte desenhada.": "The graph doesn't cross the y-axis in the drawn part.",
  "Use um número aqui, como 2 ou pi/2.": "Use a number here, like 2 or pi/2.",

  // Input bar
  "Falta a coordenada y. Exemplo: (2;3).": "The y coordinate is missing. Example: (2;3).",
  "Falta o ângulo θ, em graus. Exemplo: (3:60).": "The angle θ in degrees is missing. Example: (3:60).",
  "Falta fechar o parêntese.": "A parenthesis is not closed.",
  "Falta fechar as aspas do texto.": "The text's quotes are not closed.",
  "O texto entre aspas está vazio.": "The quoted text is empty.",
  "Coloque um ponto antes de --.": "Put a point before --.",
  "Um -- sem ponto depois fecha o contorno: ligue ao menos três pontos antes.":
    "A -- with no point after it closes the outline: connect at least three points first.",
  "Não há ponto anterior para o deslocamento partir.": "There is no previous point for the offset to start from.",
  "Use (x;y), (R:θ), +(x;y) ou +(R:θ).": "Use (x;y), (R:θ), +(x;y) or +(R:θ).",

  // Files and links
  "Não é uma figura do GeoSimples.": "This is not a GeoSimples figure.",
  "O arquivo não é uma figura do GeoSimples.": "The file is not a GeoSimples figure.",
  "O link está incompleto ou danificado.": "The link is incomplete or damaged.",
};

/** Messages with a value inside, as [Portuguese pattern, English replacement]. */
const EN_PATTERNS: [RegExp, string][] = [
  [/^A figura chegou ao limite de (\d+) elementos\.$/, "The figure reached its limit of $1 elements."],
  [/^Selecione no máximo (\d+) objetos\.$/, "Select at most $1 objects."],
  [/^A função não está definida na janela\.$/, "The function is not defined in the window."],
  [/^A função não está definida em x = (.+)\.$/, "The function is not defined at x = $1."],
  [/^(.+) não está definida na janela\.$/, "$1 is not defined in the window."],
  [/^(.+) não está definida em x = (.+)\.$/, "$1 is not defined at x = $2."],
  [/^Não há ponto chamado "(.+)"\. Para criar, use (.+)\.$/, 'There is no point named "$1". To create it, use $2.'],
  [/^Diga onde fica o texto: (.+)\.$/, "Say where the text goes: $1."],
];

/** A core message in the given language. Unknown messages stay as they are. */
export function translate(text: string, locale: Locale): string {
  if (locale === "pt-BR") return text;
  const exact = EN[text];
  if (exact) return exact;
  for (const [pattern, english] of EN_PATTERNS) {
    if (pattern.test(text)) return text.replace(pattern, english);
  }
  return text;
}

/** Whether a Portuguese message has an English version, for the catalog test. */
export function hasTranslation(text: string): boolean {
  return text in EN || EN_PATTERNS.some(([pattern]) => pattern.test(text));
}
