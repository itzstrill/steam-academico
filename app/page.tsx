"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Categoria = {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string | null;
};

type Desarrollador = {
  id_desarrollador: number;
  nombre_desarrollador: string;
  pais: string | null;
  sitio_web: string | null;
};

type VideojuegoBD = {
  id_videojuego: number;
  id_usuario: number | null;
  id_categoria: number;
  id_desarrollador: number;
  titulo: string;
  descripcion: string;
  precio: number;
  fecha_lanzamiento: string | null;
  imagen_portada: string | null;
  video_url: string | null;
  activo: boolean;
};

type Game = VideojuegoBD & {
  nombre_categoria: string;
  nombre_desarrollador: string;
};

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [developers, setDevelopers] = useState<Desarrollador[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [cart, setCart] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [view, setView] = useState<"store" | "cart" | "admin">("store");
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  const [newGame, setNewGame] = useState({
    titulo: "",
    descripcion: "",
    precio: "",
    fecha_lanzamiento: "",
    imagen_portada: "",
    video_url: "",
    id_categoria: "",
    id_desarrollador: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  function formatSupabaseError(error: unknown) {
    if (!error) return "Error desconocido";

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

  async function loadData() {
    setLoading(true);
    setConnectionError("");

    try {
      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categoria")
        .select("*")
        .order("nombre_categoria", { ascending: true });

      if (categoriasError) {
        console.error("Error categorías completo:", categoriasError);
        throw new Error(
          "Error al cargar categorías:\n" +
            formatSupabaseError(categoriasError)
        );
      }

      const { data: desarrolladoresData, error: desarrolladoresError } =
        await supabase
          .from("desarrollador")
          .select("*")
          .order("nombre_desarrollador", { ascending: true });

      if (desarrolladoresError) {
        console.error("Error desarrolladores completo:", desarrolladoresError);
        throw new Error(
          "Error al cargar desarrolladores:\n" +
            formatSupabaseError(desarrolladoresError)
        );
      }

      const { data: videojuegosData, error: videojuegosError } = await supabase
        .from("videojuego")
        .select("*")
        .eq("activo", true)
        .order("id_videojuego", { ascending: true });

      if (videojuegosError) {
        console.error("Error videojuegos completo:", videojuegosError);
        throw new Error(
          "Error al cargar videojuegos:\n" +
            formatSupabaseError(videojuegosError)
        );
      }

      const categorias = (categoriasData || []) as Categoria[];
      const desarrolladores =
        (desarrolladoresData || []) as Desarrollador[];
      const videojuegos = (videojuegosData || []) as VideojuegoBD[];

      const juegosCompletos: Game[] = videojuegos.map((juego) => {
        const categoria = categorias.find(
          (cat) => cat.id_categoria === juego.id_categoria
        );

        const desarrollador = desarrolladores.find(
          (dev) => dev.id_desarrollador === juego.id_desarrollador
        );

        return {
          ...juego,
          nombre_categoria: categoria
            ? categoria.nombre_categoria
            : "Sin categoría",
          nombre_desarrollador: desarrollador
            ? desarrollador.nombre_desarrollador
            : "Sin desarrollador",
        };
      });

      console.log("Categorías cargadas:", categorias);
      console.log("Desarrolladores cargados:", desarrolladores);
      console.log("Videojuegos cargados:", juegosCompletos);

      setCategories(categorias);
      setDevelopers(desarrolladores);
      setGames(juegosCompletos);

      if (juegosCompletos.length > 0) {
        setSelectedGame(juegosCompletos[0]);
      } else {
        setSelectedGame(null);
      }
    } catch (error) {
      console.error("Error general al cargar datos:", error);
      setConnectionError(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  const categoryNames = useMemo(() => {
    return ["Todas", ...categories.map((category) => category.nombre_categoria)];
  }, [categories]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        game.titulo.toLowerCase().includes(searchText) ||
        game.descripcion.toLowerCase().includes(searchText) ||
        game.nombre_categoria.toLowerCase().includes(searchText) ||
        game.nombre_desarrollador.toLowerCase().includes(searchText);

      const matchesCategory =
        selectedCategory === "Todas" ||
        game.nombre_categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [games, search, selectedCategory]);

  const cartTotal = cart.reduce(
    (total, game) => total + Number(game.precio),
    0
  );

  function addToCart(game: Game) {
    const exists = cart.some(
      (item) => item.id_videojuego === game.id_videojuego
    );

    if (!exists) {
      setCart([...cart, game]);
    }
  }

  function removeFromCart(id_videojuego: number) {
    setCart(cart.filter((game) => game.id_videojuego !== id_videojuego));
  }

  async function finishPurchase() {
    if (cart.length === 0) {
      alert("El carrito está vacío.");
      return;
    }

    const { data: compraData, error: compraError } = await supabase
      .from("compra")
      .insert({
        id_usuario: 2,
        total: cartTotal,
      })
      .select()
      .single();

    if (compraError) {
      console.error("Error al crear compra:", compraError);
      alert("No se pudo registrar la compra.");
      return;
    }

    const detalles = cart.map((game) => ({
      id_compra: compraData.id_compra,
      id_usuario: 2,
      id_videojuego: game.id_videojuego,
      id_categoria: game.id_categoria,
      precio_unitario: game.precio,
    }));

    const { error: detalleError } = await supabase
      .from("detalle_compra")
      .insert(detalles);

    if (detalleError) {
      console.error("Error al guardar detalle:", detalleError);
      alert("La compra se creó, pero hubo error al guardar el detalle.");
      return;
    }

    alert(
      `Compra simulada registrada en PostgreSQL.\nTotal: $${cartTotal.toFixed(
        2
      )} MXN`
    );

    setCart([]);
    setView("store");
  }

  async function addNewGame() {
    if (
      !newGame.titulo ||
      !newGame.descripcion ||
      !newGame.precio ||
      !newGame.id_categoria ||
      !newGame.id_desarrollador
    ) {
      alert("Completa título, descripción, precio, categoría y desarrollador.");
      return;
    }

    const { error } = await supabase.from("videojuego").insert({
      id_usuario: 1,
      id_categoria: Number(newGame.id_categoria),
      id_desarrollador: Number(newGame.id_desarrollador),
      titulo: newGame.titulo,
      descripcion: newGame.descripcion,
      precio: Number(newGame.precio),
      fecha_lanzamiento: newGame.fecha_lanzamiento || null,
      imagen_portada:
        newGame.imagen_portada ||
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop",
      video_url:
        newGame.video_url || "https://www.youtube.com/embed/dQw4w9WgXcQ",
      activo: true,
    });

    if (error) {
      console.error("Error al agregar videojuego:", error);
      alert("Error al agregar el videojuego.");
      return;
    }

    alert("Videojuego agregado correctamente a PostgreSQL.");

    setNewGame({
      titulo: "",
      descripcion: "",
      precio: "",
      fecha_lanzamiento: "",
      imagen_portada: "",
      video_url: "",
      id_categoria: "",
      id_desarrollador: "",
    });

    await loadData();
  }

  async function deactivateGame(id_videojuego: number) {
    const { error } = await supabase
      .from("videojuego")
      .update({ activo: false })
      .eq("id_videojuego", id_videojuego);

    if (error) {
      console.error("Error al desactivar:", error);
      alert("No se pudo desactivar el videojuego.");
      return;
    }

    alert("Videojuego desactivado correctamente.");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#10141f] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#10141f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-cyan-300 md:text-4xl">
              Steam Académico
            </h1>
            <p className="text-sm text-slate-300">
              Proyecto web conectado a Supabase PostgreSQL
            </p>
          </div>

          <nav className="flex flex-wrap gap-3">
            <button
              onClick={() => setView("store")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                view === "store"
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              Tienda
            </button>

            <button
              onClick={() => setView("cart")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                view === "cart"
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              Carrito ({cart.length})
            </button>

            <button
              onClick={() => setView("admin")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                view === "admin"
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              Administrador
            </button>
          </nav>
        </div>
      </header>

      {loading && (
        <section className="mx-auto max-w-7xl px-6 py-20 text-center">
          <h2 className="text-3xl font-black text-cyan-300">
            Cargando videojuegos desde PostgreSQL...
          </h2>
        </section>
      )}

      {!loading && connectionError && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6">
            <h2 className="mb-4 text-2xl font-black text-red-300">
              Error de conexión con Supabase
            </h2>

            <p className="mb-4 text-slate-300">
              La página sí está funcionando, pero no pudo leer las tablas desde
              Supabase. Revisa que tu archivo{" "}
              <span className="font-bold text-cyan-300">.env.local</span> tenga
              el Project URL correcto y que la Data API exponga el schema public.
            </p>

            <pre className="max-h-96 overflow-auto rounded-2xl bg-black/40 p-4 text-sm text-red-100">
              {connectionError}
            </pre>

            <button
              onClick={loadData}
              className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
            >
              Reintentar conexión
            </button>
          </div>
        </section>
      )}

      {!loading && !connectionError && view === "store" && (
        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_380px]">
          <div>
            <section className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-purple-700/20 p-8 shadow-2xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                Base de Datos Avanzadas
              </p>
              <h2 className="mb-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
                Catálogo digital de videojuegos con carrito y panel administrativo
              </h2>
              <p className="max-w-3xl text-slate-300">
                Los datos mostrados se consultan desde tablas reales de
                PostgreSQL alojadas en Supabase.
              </p>
            </section>

            <section className="mb-6 grid gap-4 md:grid-cols-[1fr_220px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar videojuego, categoría o desarrollador..."
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />

              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-white outline-none focus:border-cyan-300"
              >
                {categoryNames.map((category) => (
                  <option key={category} value={category} className="bg-slate-900">
                    {category}
                  </option>
                ))}
              </select>
            </section>

            {filteredGames.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                <p className="text-xl font-bold text-slate-300">
                  No se encontraron videojuegos.
                </p>
              </div>
            ) : (
              <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredGames.map((game) => (
                  <article
                    key={game.id_videojuego}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl transition hover:-translate-y-1 hover:border-cyan-300/70 hover:bg-white/10"
                  >
                    <button
                      onClick={() => setSelectedGame(game)}
                      className="block w-full text-left"
                    >
                      <img
                        src={
                          game.imagen_portada ||
                          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop"
                        }
                        alt={game.titulo}
                        className="h-44 w-full object-cover"
                      />

                      <div className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-bold text-cyan-200">
                            {game.nombre_categoria}
                          </span>
                          <span className="text-sm font-black text-green-300">
                            ${Number(game.precio).toFixed(2)}
                          </span>
                        </div>

                        <h3 className="mb-2 text-xl font-black">{game.titulo}</h3>
                        <p className="mb-3 text-sm text-slate-400">
                          {game.nombre_desarrollador}
                        </p>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-300">
                          {game.descripcion}
                        </p>
                      </div>
                    </button>

                    <div className="border-t border-white/10 p-5">
                      <button
                        onClick={() => addToCart(game)}
                        className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                      >
                        Agregar al carrito
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>

          {selectedGame && (
            <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl lg:sticky lg:top-28">
              <img
                src={
                  selectedGame.imagen_portada ||
                  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop"
                }
                alt={selectedGame.titulo}
                className="mb-5 h-56 w-full rounded-2xl object-cover"
              />

              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black">{selectedGame.titulo}</h2>
                <span className="rounded-xl bg-green-400 px-3 py-2 text-sm font-black text-slate-950">
                  ${Number(selectedGame.precio).toFixed(2)}
                </span>
              </div>

              <p className="mb-2 text-sm text-slate-400">
                Desarrollador: {selectedGame.nombre_desarrollador}
              </p>
              <p className="mb-2 text-sm text-slate-400">
                Categoría: {selectedGame.nombre_categoria}
              </p>
              <p className="mb-5 text-sm text-slate-400">
                Lanzamiento:{" "}
                {selectedGame.fecha_lanzamiento || "Sin fecha registrada"}
              </p>

              <p className="mb-5 leading-7 text-slate-300">
                {selectedGame.descripcion}
              </p>

              {selectedGame.video_url && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
                  <iframe
                    className="aspect-video w-full"
                    src={selectedGame.video_url}
                    title={`Trailer de ${selectedGame.titulo}`}
                    allowFullScreen
                  />
                </div>
              )}

              <button
                onClick={() => addToCart(selectedGame)}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Agregar al carrito
              </button>
            </aside>
          )}
        </section>
      )}

      {!loading && !connectionError && view === "cart" && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-6 text-4xl font-black">Carrito de compras</h2>

          {cart.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-xl font-bold text-slate-300">
                Todavía no has agregado videojuegos al carrito.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {cart.map((game) => (
                <article
                  key={game.id_videojuego}
                  className="grid gap-5 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-[160px_1fr_auto]"
                >
                  <img
                    src={
                      game.imagen_portada ||
                      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop"
                    }
                    alt={game.titulo}
                    className="h-32 w-full rounded-2xl object-cover md:w-40"
                  />

                  <div>
                    <h3 className="text-2xl font-black">{game.titulo}</h3>
                    <p className="text-sm text-slate-400">
                      {game.nombre_categoria}
                    </p>
                    <p className="mt-2 text-slate-300">{game.descripcion}</p>
                  </div>

                  <div className="flex flex-col items-start justify-between gap-4 md:items-end">
                    <p className="text-xl font-black text-green-300">
                      ${Number(game.precio).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(game.id_videojuego)}
                      className="rounded-xl bg-red-500/20 px-4 py-2 font-bold text-red-200 hover:bg-red-500/30"
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}

              <div className="rounded-3xl border border-cyan-300/30 bg-cyan-400/10 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xl font-bold">Total de compra:</span>
                  <span className="text-3xl font-black text-green-300">
                    ${cartTotal.toFixed(2)} MXN
                  </span>
                </div>

                <button
                  onClick={finishPurchase}
                  className="w-full rounded-2xl bg-green-400 px-4 py-4 font-black text-slate-950 transition hover:bg-green-300"
                >
                  Finalizar compra simulada
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {!loading && !connectionError && view === "admin" && (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
              Acceso administrativo
            </p>
            <h2 className="text-4xl font-black">Panel de administrador</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              Desde aquí se agregan y desactivan videojuegos directamente en la
              tabla videojuego de PostgreSQL.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-5 text-2xl font-black">Agregar videojuego</h3>

              <div className="grid gap-4">
                <input
                  value={newGame.titulo}
                  onChange={(event) =>
                    setNewGame({ ...newGame, titulo: event.target.value })
                  }
                  placeholder="Título"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <textarea
                  value={newGame.descripcion}
                  onChange={(event) =>
                    setNewGame({ ...newGame, descripcion: event.target.value })
                  }
                  placeholder="Descripción"
                  rows={5}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <input
                  value={newGame.precio}
                  onChange={(event) =>
                    setNewGame({ ...newGame, precio: event.target.value })
                  }
                  placeholder="Precio"
                  type="number"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <input
                  value={newGame.fecha_lanzamiento}
                  onChange={(event) =>
                    setNewGame({
                      ...newGame,
                      fecha_lanzamiento: event.target.value,
                    })
                  }
                  type="date"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <select
                  value={newGame.id_categoria}
                  onChange={(event) =>
                    setNewGame({ ...newGame, id_categoria: event.target.value })
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                >
                  <option value="" className="bg-slate-900">
                    Selecciona una categoría
                  </option>
                  {categories.map((category) => (
                    <option
                      key={category.id_categoria}
                      value={category.id_categoria}
                      className="bg-slate-900"
                    >
                      {category.nombre_categoria}
                    </option>
                  ))}
                </select>

                <select
                  value={newGame.id_desarrollador}
                  onChange={(event) =>
                    setNewGame({
                      ...newGame,
                      id_desarrollador: event.target.value,
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                >
                  <option value="" className="bg-slate-900">
                    Selecciona un desarrollador
                  </option>
                  {developers.map((developer) => (
                    <option
                      key={developer.id_desarrollador}
                      value={developer.id_desarrollador}
                      className="bg-slate-900"
                    >
                      {developer.nombre_desarrollador}
                    </option>
                  ))}
                </select>

                <input
                  value={newGame.imagen_portada}
                  onChange={(event) =>
                    setNewGame({
                      ...newGame,
                      imagen_portada: event.target.value,
                    })
                  }
                  placeholder="URL de imagen"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <input
                  value={newGame.video_url}
                  onChange={(event) =>
                    setNewGame({ ...newGame, video_url: event.target.value })
                  }
                  placeholder="URL de video embed de YouTube"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <button
                  onClick={addNewGame}
                  className="rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Guardar videojuego en PostgreSQL
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-5 text-2xl font-black">
                Inventario de videojuegos
              </h3>

              <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-slate-300">
                Categorías cargadas:{" "}
                <span className="font-black text-cyan-300">
                  {categories.length}
                </span>{" "}
                | Desarrolladores cargados:{" "}
                <span className="font-black text-cyan-300">
                  {developers.length}
                </span>{" "}
                | Videojuegos activos:{" "}
                <span className="font-black text-cyan-300">
                  {games.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-sm text-slate-400">
                      <th className="p-3">ID</th>
                      <th className="p-3">Título</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Desarrollador</th>
                      <th className="p-3">Precio</th>
                      <th className="p-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <tr
                        key={game.id_videojuego}
                        className="border-b border-white/10"
                      >
                        <td className="p-3">{game.id_videojuego}</td>
                        <td className="p-3 font-bold">{game.titulo}</td>
                        <td className="p-3">{game.nombre_categoria}</td>
                        <td className="p-3">{game.nombre_desarrollador}</td>
                        <td className="p-3">${Number(game.precio).toFixed(2)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => deactivateGame(game.id_videojuego)}
                            className="rounded-xl bg-red-500/20 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/30"
                          >
                            Desactivar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}