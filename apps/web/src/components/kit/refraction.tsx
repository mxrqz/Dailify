import { Fragment, useEffect } from "react";

/**
 * Refração do vidro (o "liquid glass" do hyprglass): o fundo atrás do vidro escorrega pra fora perto
 * das bordas, o meio fica parado, e cada canal anda um pouco diferente (R ×0.825, G ×1, B ×1.175) —
 * o arco-íris fraco na aresta. Montado uma vez na raiz; o `--refract` do global.css aponta pra cá.
 *
 * O mapa de deslocamento nasce dentro do filtro, do tamanho de quem usa: o flood da caixa, deslocado
 * `edge` px pra um lado e pro outro e desfocado num eixo só, abre um vão numa borda ou na outra; a
 * diferença das duas cópias é − perto da borda de cima/esquerda, + perto da de baixo/direita e 0
 * no meio, sumindo a ~3×edge, em px qualquer que seja a caixa. Um <filter> só serve pra qualquer
 * tamanho. Nada lê fora da caixa (o filtro é cortado nela e fora é vazio), e percentual num
 * feImage não serve: mede contra o <svg> de 0×0, não contra o elemento.
 *
 * Só o Chromium aplica url() no backdrop-filter (Safari invalida a declaração inteira, o Firefox
 * engana o @supports): marca `<html class="refract">` só lá.
 */
export function Refraction({
  strength = 24,
  edge = 10,
}: {
  /** Escala do feDisplacementMap: o fundo anda até strength/2 px colado na aresta. */
  strength?: number;
  /** Desvio do desfoque que faz a borda, em px: a refração some a ~3×edge da aresta. */
  edge?: number;
}): JSX.Element {
  useEffect(() => {
    if (!navigator.userAgentData?.brands.some((b) => b.brand === "Chromium")) return;
    document.documentElement.classList.add("refract");
    return () => document.documentElement.classList.remove("refract");
  }, []);

  // Campo de um eixo em alfa: 0.5 + 1.3·(A − B), A e B a caixa deslocada +edge e −edge e desfocada.
  // O vão de `edge` desfocado com σ = edge chega a 2Φ(0.5) − 1 ≈ 0.38: ×1.3 leva o pico a ±0.5. Acima
  // de 128 (perto da borda de baixo/direita) o mapa amostra pra +, pra fora; o meio fica em 128.
  // O feColorMatrix leva o alfa pro canal do eixo (R = x, G = y), com alfa 1.
  const axis = (x: boolean) => (
    <>
      {[edge, -edge].map((d) => (
        <Fragment key={d}>
          <feOffset in="box" dx={x ? d : 0} dy={x ? 0 : d} />
          <feGaussianBlur stdDeviation={x ? `${edge} 0` : `0 ${edge}`} result={d > 0 ? "A" : "B"} />
        </Fragment>
      ))}
      <feComposite in="A" in2="B" operator="arithmetic" k2={1.3} k3={-1.3} k4={0.5} />
      <feColorMatrix
        values={`0 0 0 ${x ? 1 : 0} 0  0 0 0 ${x ? 0 : 1} 0  0 0 0 0 0  0 0 0 0 1`}
        result={x ? "mx" : "my"}
      />
    </>
  );
  const channel = (scale: number, row: number, result: string) => (
    <>
      <feDisplacementMap
        in="SourceGraphic"
        in2="map"
        scale={strength * scale}
        xChannelSelector="R"
        yChannelSelector="G"
      />
      {/* Fica só com o canal `row`, alfa 1: somar os três (clampado em 1) remonta a cor. */}
      <feColorMatrix
        values={[0, 1, 2]
          .map((r) => [0, 1, 2, 3, 4].map((c) => Number(r === row && c === row)).join(" "))
          .concat("0 0 0 0 1")
          .join("  ")}
        result={result}
      />
    </>
  );

  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <filter id="refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood floodColor="#fff" result="box" />
        {axis(true)}
        {axis(false)}
        <feComposite in="mx" in2="my" operator="arithmetic" k2={1} k3={1} result="map" />
        {channel(0.825, 0, "r")}
        {channel(1, 1, "g")}
        {channel(1.175, 2, "b")}
        <feComposite in="r" in2="g" operator="arithmetic" k2={1} k3={1} />
        <feComposite in2="b" operator="arithmetic" k2={1} k3={1} />
      </filter>
    </svg>
  );
}
