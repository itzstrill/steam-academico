"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
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

type Perfil = {
  id_usuario: number;
  auth_id: string | null;
  nombre_usuario: string;
  correo: string;
  rol: "usuario" | "cliente" | "desarrollador" | "admin";
  fecha_registro: string;
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

type ResenaConUsuario = {
  id_resena: number;
  id_usuario: number;
  id_videojuego: number;
  id_categoria: number | null;
  comentario: string | null;
  fecha_resena: string;
  calificacion: number;
  nombre_usuario: string;
};

type UploadedMediaInfo = {
  publicUrl: string;
  filePath: string;
  extension: string;
};

type MultimediaRow = {
  id_videojuego: number;
  id_usuario: number;
  id_categoria: number;
  nombre_archivo: string;
  tipo_archivo: "imagen" | "video";
  url_archivo: string;
  descripcion: string;
};

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [developers, setDevelopers] = useState<Desarrollador[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [cart, setCart] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [view, setView] = useState<"store" | "cart" | "admin" | "auth">(
    "store"
  );

  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);

  const [reviews, setReviews] = useState<ResenaConUsuario[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    comentario: "",
    calificacion: "5",
  });

  const [authForm, setAuthForm] = useState({
    nombre_usuario: "",
    correo: "",
    password: "",
  });

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

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    startApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (!user) {
        setProfile(null);
        return;
      }

      setTimeout(async () => {
        const userProfile = await ensureProfile(user);
        setProfile(userProfile);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedGame) {
      loadReviewsForGame(selectedGame.id_videojuego);
      checkReviewPermission(selectedGame);
    }
  }, [selectedGame?.id_videojuego, profile?.id_usuario]);

  async function startApp() {
    setLoading(true);
    setConnectionError("");

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setConnectionError(
        "La carga tardó demasiado. Es posible que la sesión de Supabase se haya quedado atorada. Prueba cerrar sesión de emergencia o revisar la conexión."
      );
    }, 15000);

    try {
      await loadData();
      await checkCurrentSession();
      clearTimeout(safetyTimeout);
      setLoading(false);
    } catch (error) {
      clearTimeout(safetyTimeout);
      console.error("Error al iniciar aplicación:", error);
      setConnectionError(
        error instanceof Error ? error.message : String(error)
      );
      setLoading(false);
    }
  }

  function formatSupabaseError(error: unknown) {
    if (!error) return "Error desconocido";

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

  async function checkCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error al revisar sesión:", error);
      setCurrentUser(null);
      setProfile(null);
      return;
    }

    const user = data.session?.user ?? null;
    setCurrentUser(user);

    if (!user) {
      setProfile(null);
      return;
    }

    const userProfile = await ensureProfile(user);
    setProfile(userProfile);
  }

  async function ensureProfile(user: User): Promise<Perfil | null> {
    if (!user.email) return null;

    const correo = user.email.toLowerCase();
    const nombre =
      String(user.user_metadata?.nombre_usuario || "").trim() ||
      correo.split("@")[0];

    const { data: perfilPorAuth, error: errorAuth } = await supabase
      .from("usuario")
      .select("*")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (errorAuth) {
      console.error("Error buscando perfil por auth_id:", errorAuth);
      return null;
    }

    if (perfilPorAuth) {
      return perfilPorAuth as Perfil;
    }

    const { data: perfilPorCorreo, error: errorCorreo } = await supabase
      .from("usuario")
      .select("*")
      .eq("correo", correo)
      .maybeSingle();

    if (errorCorreo) {
      console.error("Error buscando perfil por correo:", errorCorreo);
      return null;
    }

    if (perfilPorCorreo) {
      const perfilExistente = perfilPorCorreo as Perfil;

      const { data: perfilActualizado, error: errorUpdate } = await supabase
        .from("usuario")
        .update({
          auth_id: user.id,
          nombre_usuario: perfilExistente.nombre_usuario || nombre,
        })
        .eq("id_usuario", perfilExistente.id_usuario)
        .select("*")
        .single();

      if (errorUpdate) {
        console.error("Error actualizando auth_id:", errorUpdate);
        return perfilExistente;
      }

      return perfilActualizado as Perfil;
    }

    const { data: perfilCreado, error: errorInsert } = await supabase
      .from("usuario")
      .insert({
        auth_id: user.id,
        nombre_usuario: nombre,
        correo: correo,
        rol: "cliente",
      })
      .select("*")
      .single();

    if (errorInsert) {
      console.error("Error creando perfil:", errorInsert);
      return null;
    }

    return perfilCreado as Perfil;
  }

  async function loadData() {
    setConnectionError("");

    const { data: categoriasData, error: categoriasError } = await supabase
      .from("categoria")
      .select("*")
      .order("nombre_categoria", { ascending: true });

    if (categoriasError) {
      throw new Error(
        "Error al cargar categorías:\n" + formatSupabaseError(categoriasError)
      );
    }

    const { data: desarrolladoresData, error: desarrolladoresError } =
      await supabase
        .from("desarrollador")
        .select("*")
        .order("nombre_desarrollador", { ascending: true });

    if (desarrolladoresError) {
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
      throw new Error(
        "Error al cargar videojuegos:\n" + formatSupabaseError(videojuegosError)
      );
    }

    const categorias = (categoriasData || []) as Categoria[];
    const desarrolladores = (desarrolladoresData || []) as Desarrollador[];
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

    setCategories(categorias);
    setDevelopers(desarrolladores);
    setGames(juegosCompletos);

    if (juegosCompletos.length > 0) {
      setSelectedGame(juegosCompletos[0]);
    } else {
      setSelectedGame(null);
    }
  }

  async function loadReviewsForGame(id_videojuego: number) {
    const { data: resenasData, error: resenasError } = await supabase
      .from("resena")
      .select("*")
      .eq("id_videojuego", id_videojuego)
      .order("fecha_resena", { ascending: false });

    if (resenasError) {
      console.error("Error al cargar reseñas:", resenasError);
      setReviews([]);
      return;
    }

    const resenas = resenasData || [];
    const usuariosIds = Array.from(
      new Set(resenas.map((resena) => resena.id_usuario))
    );

    let usuarios: { id_usuario: number; nombre_usuario: string }[] = [];

    if (usuariosIds.length > 0) {
      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuario")
        .select("id_usuario, nombre_usuario")
        .in("id_usuario", usuariosIds);

      if (usuariosError) {
        console.error("Error al cargar usuarios de reseñas:", usuariosError);
      } else {
        usuarios = usuariosData || [];
      }
    }

    const resenasCompletas: ResenaConUsuario[] = resenas.map((resena) => {
      const usuario = usuarios.find(
        (item) => item.id_usuario === resena.id_usuario
      );

      return {
        id_resena: resena.id_resena,
        id_usuario: resena.id_usuario,
        id_videojuego: resena.id_videojuego,
        id_categoria: resena.id_categoria,
        comentario: resena.comentario,
        fecha_resena: resena.fecha_resena,
        calificacion: resena.calificacion,
        nombre_usuario: usuario ? usuario.nombre_usuario : "Usuario",
      };
    });

    setReviews(resenasCompletas);
  }

  async function checkReviewPermission(game: Game) {
    setCanReview(false);
    setReviewStatus("");

    if (!profile) {
      setReviewStatus("Inicia sesión para poder dejar una reseña.");
      return;
    }

    const { data: alreadyReviewed, error: alreadyReviewedError } =
      await supabase
        .from("resena")
        .select("id_resena")
        .eq("id_usuario", profile.id_usuario)
        .eq("id_videojuego", game.id_videojuego)
        .maybeSingle();

    if (alreadyReviewedError) {
      console.error(
        "Error al verificar reseña existente:",
        alreadyReviewedError
      );
      setReviewStatus("No se pudo verificar si ya reseñaste este videojuego.");
      return;
    }

    if (alreadyReviewed) {
      setReviewStatus("Ya dejaste una reseña para este videojuego.");
      return;
    }

    const { data: boughtGame, error: boughtGameError } = await supabase.rpc(
      "usuario_compro_videojuego",
      {
        p_id_usuario: profile.id_usuario,
        p_id_videojuego: game.id_videojuego,
      }
    );

    if (boughtGameError) {
      console.error("Error al verificar compra:", boughtGameError);
      setReviewStatus("No se pudo verificar si compraste este videojuego.");
      return;
    }

    if (!boughtGame) {
      setReviewStatus("Solo puedes reseñar videojuegos que ya compraste.");
      return;
    }

    setCanReview(true);
    setReviewStatus("Puedes dejar una reseña para este videojuego.");
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !selectedGame) {
      alert("Debes iniciar sesión y seleccionar un videojuego.");
      return;
    }

    if (!canReview) {
      alert("No puedes reseñar este videojuego.");
      return;
    }

    if (!reviewForm.comentario.trim()) {
      alert("Escribe un comentario para la reseña.");
      return;
    }

    setReviewLoading(true);

    const { error } = await supabase.from("resena").insert({
      id_usuario: profile.id_usuario,
      id_videojuego: selectedGame.id_videojuego,
      id_categoria: selectedGame.id_categoria,
      comentario: reviewForm.comentario,
      calificacion: Number(reviewForm.calificacion),
    });

    if (error) {
      console.error("Error al guardar reseña:", error);
      alert(
        "No se pudo guardar la reseña. Es posible que ya hayas reseñado este juego."
      );
      setReviewLoading(false);
      return;
    }

    alert("Reseña guardada correctamente.");

    setReviewForm({
      comentario: "",
      calificacion: "5",
    });

    setCanReview(false);
    setReviewStatus("Ya dejaste una reseña para este videojuego.");

    await loadReviewsForGame(selectedGame.id_videojuego);
    setReviewLoading(false);
  }

  function isMp4Url(url: string | null) {
    if (!url) return false;
    return url.toLowerCase().includes(".mp4");
  }

  function validateMediaFile(file: File, type: "image" | "video") {
    const allowedImageTypes = ["image/jpeg", "image/png", "image/gif"];
    const allowedVideoTypes = ["video/mp4"];

    if (type === "image" && !allowedImageTypes.includes(file.type)) {
      throw new Error("La imagen debe ser JPG, PNG o GIF.");
    }

    if (type === "video" && !allowedVideoTypes.includes(file.type)) {
      throw new Error("El video debe ser MP4.");
    }

    const maxSizeMB = type === "image" ? 5 : 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new Error(
        type === "image"
          ? "La imagen no debe pesar más de 5 MB."
          : "El video no debe pesar más de 10 MB."
      );
    }
  }

  async function uploadGameMedia(file: File, folder: "imagenes" | "videos") {
    if (!profile) {
      throw new Error("Debes iniciar sesión para subir archivos.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "file";

    const cleanName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase();

    const filePath = `${folder}/${profile.id_usuario}-${Date.now()}-${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from("game-media")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Error al subir archivo:", uploadError);
      throw new Error("No se pudo subir el archivo multimedia.");
    }

    const { data } = supabase.storage
      .from("game-media")
      .getPublicUrl(filePath);

    return {
      publicUrl: data.publicUrl,
      filePath,
      extension,
    };
  }

  async function emergencyLogout() {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      setCurrentUser(null);
      setProfile(null);
      setCart([]);
      setConnectionError("");
      setLoading(false);
      setView("store");
      location.reload();
    } catch (error) {
      console.error("Error en cierre de sesión de emergencia:", error);
      localStorage.clear();
      sessionStorage.clear();
      location.reload();
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);

    if (!authForm.nombre_usuario || !authForm.correo || !authForm.password) {
      alert("Completa nombre, correo y contraseña.");
      setAuthLoading(false);
      return;
    }

    if (authForm.password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      setAuthLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authForm.correo.toLowerCase(),
      password: authForm.password,
      options: {
        data: {
          nombre_usuario: authForm.nombre_usuario,
        },
      },
    });

    if (error) {
      console.error("Error de registro:", error);
      alert(error.message);
      setAuthLoading(false);
      return;
    }

    if (data.user) {
      const userProfile = await ensureProfile(data.user);
      setProfile(userProfile);
    }

    if (data.session?.user) {
      setCurrentUser(data.session.user);
      const userProfile = await ensureProfile(data.session.user);
      setProfile(userProfile);
      alert("Cuenta creada e inicio de sesión realizado correctamente.");
      setView("store");
    } else {
      alert(
        "Cuenta creada. Si Supabase solicita confirmación, revisa tu correo antes de iniciar sesión."
      );
      setAuthMode("login");
    }

    setAuthForm({
      nombre_usuario: "",
      correo: "",
      password: "",
    });

    setAuthLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);

    if (!authForm.correo || !authForm.password) {
      alert("Escribe tu correo y contraseña.");
      setAuthLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authForm.correo.toLowerCase(),
      password: authForm.password,
    });

    if (error) {
      console.error("Error de inicio de sesión:", error);
      alert(error.message);
      setAuthLoading(false);
      return;
    }

    if (data.user) {
      setCurrentUser(data.user);
      const userProfile = await ensureProfile(data.user);
      setProfile(userProfile);
    }

    setAuthForm({
      nombre_usuario: "",
      correo: "",
      password: "",
    });

    alert("Inicio de sesión correcto.");
    setView("store");
    setAuthLoading(false);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error cerrando sesión:", error);
      await emergencyLogout();
      return;
    }

    setCurrentUser(null);
    setProfile(null);
    setCart([]);
    setView("store");
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

    if (!profile) {
      alert("Debes iniciar sesión para finalizar la compra.");
      setView("auth");
      return;
    }

    const { data: compraData, error: compraError } = await supabase
      .from("compra")
      .insert({
        id_usuario: profile.id_usuario,
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
      id_usuario: profile.id_usuario,
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
      `Compra simulada registrada en PostgreSQL.\nUsuario: ${
        profile.nombre_usuario
      }\nTotal: $${cartTotal.toFixed(2)} MXN`
    );

    setCart([]);
    setView("store");

    if (selectedGame) {
      await checkReviewPermission(selectedGame);
    }
  }

  async function addNewGame() {
    if (profile?.rol !== "admin" && profile?.rol !== "desarrollador") {
      alert("Solo un administrador o desarrollador puede agregar videojuegos.");
      return;
    }

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

    try {
      setUploadingMedia(true);

      let finalImageUrl = newGame.imagen_portada;
      let finalVideoUrl = newGame.video_url;

      let uploadedImageInfo: UploadedMediaInfo | null = null;
      let uploadedVideoInfo: UploadedMediaInfo | null = null;

      if (imageFile) {
        validateMediaFile(imageFile, "image");
        uploadedImageInfo = await uploadGameMedia(imageFile, "imagenes");
        finalImageUrl = uploadedImageInfo.publicUrl;
      }

      if (videoFile) {
        validateMediaFile(videoFile, "video");
        uploadedVideoInfo = await uploadGameMedia(videoFile, "videos");
        finalVideoUrl = uploadedVideoInfo.publicUrl;
      }

      const { data: createdGame, error } = await supabase
        .from("videojuego")
        .insert({
          id_usuario: profile.id_usuario,
          id_categoria: Number(newGame.id_categoria),
          id_desarrollador: Number(newGame.id_desarrollador),
          titulo: newGame.titulo,
          descripcion: newGame.descripcion,
          precio: Number(newGame.precio),
          fecha_lanzamiento: newGame.fecha_lanzamiento || null,
          imagen_portada:
            finalImageUrl ||
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop",
          video_url:
            finalVideoUrl || "https://www.youtube.com/embed/dQw4w9WgXcQ",
          activo: true,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Error al agregar videojuego:", error);
        alert("Error al agregar el videojuego.");
        setUploadingMedia(false);
        return;
      }

      const multimediaRows: MultimediaRow[] = [];

      if (uploadedImageInfo && imageFile) {
        multimediaRows.push({
          id_videojuego: createdGame.id_videojuego,
          id_usuario: profile.id_usuario,
          id_categoria: Number(newGame.id_categoria),
          nombre_archivo: imageFile.name,
          tipo_archivo: "imagen",
          url_archivo: uploadedImageInfo.publicUrl,
          descripcion: "Imagen cargada desde el panel administrador.",
        });
      }

      if (uploadedVideoInfo && videoFile) {
        multimediaRows.push({
          id_videojuego: createdGame.id_videojuego,
          id_usuario: profile.id_usuario,
          id_categoria: Number(newGame.id_categoria),
          nombre_archivo: videoFile.name,
          tipo_archivo: "video",
          url_archivo: uploadedVideoInfo.publicUrl,
          descripcion: "Video MP4 cargado desde el panel administrador.",
        });
      }

      if (multimediaRows.length > 0) {
        const { error: multimediaError } = await supabase
          .from("archivo_multimedia")
          .insert(multimediaRows);

        if (multimediaError) {
          console.error("Error al registrar multimedia:", multimediaError);
          alert(
            "El videojuego se guardó, pero hubo un problema al registrar la multimedia."
          );
        }
      }

      alert("Videojuego agregado correctamente con multimedia.");

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

      setImageFile(null);
      setVideoFile(null);

      await loadData();
    } catch (error) {
      console.error("Error general al guardar videojuego:", error);
      alert(
        error instanceof Error ? error.message : "Error al guardar el juego."
      );
    } finally {
      setUploadingMedia(false);
    }
  }

  async function deactivateGame(id_videojuego: number) {
    if (profile?.rol !== "admin" && profile?.rol !== "desarrollador") {
      alert("Solo un administrador o desarrollador puede desactivar videojuegos.");
      return;
    }

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

          <nav className="flex flex-wrap items-center gap-3">
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

            {(profile?.rol === "admin" || profile?.rol === "desarrollador") && (
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
            )}

            {!currentUser ? (
              <button
                onClick={() => setView("auth")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  view === "auth"
                    ? "bg-green-400 text-slate-950"
                    : "bg-green-500/20 text-green-200 hover:bg-green-500/30"
                }`}
              >
                Iniciar sesión
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/10 px-4 py-2">
                <span className="text-sm text-slate-200">
                  {profile?.nombre_usuario || currentUser.email}
                  {profile?.rol && (
                    <span className="ml-2 rounded-full bg-cyan-400 px-2 py-1 text-xs font-black uppercase text-slate-950">
                      {profile.rol}
                    </span>
                  )}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-bold text-red-200 hover:text-red-100"
                >
                  Salir
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {loading && (
        <section className="mx-auto max-w-7xl px-6 py-20 text-center">
          <h2 className="text-3xl font-black text-cyan-300">
            Cargando videojuegos desde PostgreSQL...
          </h2>

          <button
            onClick={emergencyLogout}
            className="mt-8 rounded-2xl bg-red-500/20 px-5 py-3 font-black text-red-100 hover:bg-red-500/30"
          >
            Cerrar sesión de emergencia
          </button>
        </section>
      )}

      {!loading && connectionError && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6">
            <h2 className="mb-4 text-2xl font-black text-red-300">
              Error de conexión o carga
            </h2>

            <pre className="max-h-96 overflow-auto rounded-2xl bg-black/40 p-4 text-sm text-red-100">
              {connectionError}
            </pre>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={startApp}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
              >
                Reintentar conexión
              </button>

              <button
                onClick={emergencyLogout}
                className="rounded-2xl bg-red-500/20 px-5 py-3 font-black text-red-100 hover:bg-red-500/30"
              >
                Cerrar sesión de emergencia
              </button>
            </div>
          </div>
        </section>
      )}

      {!loading && !connectionError && view === "auth" && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                Usuarios
              </p>
              <h2 className="mb-4 text-4xl font-black">
                {authMode === "login" ? "Iniciar sesión" : "Crear una cuenta"}
              </h2>
              <p className="mb-6 text-slate-300">
                El usuario podrá crear una cuenta, iniciar sesión y finalizar
                compras simuladas asociadas a su perfil.
              </p>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`rounded-2xl px-4 py-3 font-black ${
                    authMode === "login"
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-white/10"
                  }`}
                >
                  Ingresar
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`rounded-2xl px-4 py-3 font-black ${
                    authMode === "register"
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-white/10"
                  }`}
                >
                  Registrarse
                </button>
              </div>

              <form
                onSubmit={authMode === "login" ? handleLogin : handleRegister}
                className="grid gap-4"
              >
                {authMode === "register" && (
                  <input
                    value={authForm.nombre_usuario}
                    onChange={(event) =>
                      setAuthForm({
                        ...authForm,
                        nombre_usuario: event.target.value,
                      })
                    }
                    placeholder="Nombre de usuario"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                  />
                )}

                <input
                  value={authForm.correo}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, correo: event.target.value })
                  }
                  placeholder="Correo electrónico"
                  type="email"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <input
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  placeholder="Contraseña"
                  type="password"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <button
                  disabled={authLoading}
                  className="rounded-2xl bg-green-400 px-4 py-3 font-black text-slate-950 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading
                    ? "Procesando..."
                    : authMode === "login"
                    ? "Iniciar sesión"
                    : "Crear cuenta"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-purple-700/20 p-8">
              <h3 className="mb-4 text-3xl font-black">
                Funciones del sistema
              </h3>
              <ul className="grid gap-4 text-slate-200">
                <li className="rounded-2xl bg-black/20 p-4">
                  Registro con correo y contraseña usando Supabase Auth.
                </li>
                <li className="rounded-2xl bg-black/20 p-4">
                  Perfil propio en la tabla usuario de PostgreSQL.
                </li>
                <li className="rounded-2xl bg-black/20 p-4">
                  Compras simuladas asociadas al usuario autenticado.
                </li>
                <li className="rounded-2xl bg-black/20 p-4">
                  Reseñas disponibles únicamente para videojuegos comprados.
                </li>
                <li className="rounded-2xl bg-black/20 p-4">
                  Carga de multimedia JPG, PNG, GIF y MP4 con Supabase Storage.
                </li>
              </ul>
            </section>
          </div>
        </section>
      )}

      {!loading && !connectionError && view === "store" && (
        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_420px]">
          <div>
            <section className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-purple-700/20 p-8 shadow-2xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                GameOrbit
              </p>
              <h2 className="mb-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
                Catálogo digital de videojuegos con carrito, reseñas y panel
                administrativo
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
                  <option
                    key={category}
                    value={category}
                    className="bg-slate-900"
                  >
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

                        <h3 className="mb-2 text-xl font-black">
                          {game.titulo}
                        </h3>
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
                  {isMp4Url(selectedGame.video_url) ? (
                    <video className="aspect-video w-full" controls>
                      <source src={selectedGame.video_url} type="video/mp4" />
                      Tu navegador no soporta reproducción de video.
                    </video>
                  ) : (
                    <iframe
                      className="aspect-video w-full"
                      src={selectedGame.video_url}
                      title={`Trailer de ${selectedGame.titulo}`}
                      allowFullScreen
                    />
                  )}
                </div>
              )}

              <button
                onClick={() => addToCart(selectedGame)}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Agregar al carrito
              </button>

              <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="mb-4 text-xl font-black text-cyan-300">
                  Reseñas del videojuego
                </h3>

                <div className="mb-4 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                  {reviewStatus}
                </div>

                {canReview && (
                  <form onSubmit={submitReview} className="mb-5 grid gap-3">
                    <select
                      value={reviewForm.calificacion}
                      onChange={(event) =>
                        setReviewForm({
                          ...reviewForm,
                          calificacion: event.target.value,
                        })
                      }
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-cyan-300"
                    >
                      <option value="5" className="bg-slate-900">
                        5 estrellas
                      </option>
                      <option value="4" className="bg-slate-900">
                        4 estrellas
                      </option>
                      <option value="3" className="bg-slate-900">
                        3 estrellas
                      </option>
                      <option value="2" className="bg-slate-900">
                        2 estrellas
                      </option>
                      <option value="1" className="bg-slate-900">
                        1 estrella
                      </option>
                    </select>

                    <textarea
                      value={reviewForm.comentario}
                      onChange={(event) =>
                        setReviewForm({
                          ...reviewForm,
                          comentario: event.target.value,
                        })
                      }
                      placeholder="Escribe tu reseña..."
                      rows={4}
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                    />

                    <button
                      disabled={reviewLoading}
                      className="rounded-xl bg-green-400 px-4 py-3 font-black text-slate-950 hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewLoading ? "Guardando..." : "Publicar reseña"}
                    </button>
                  </form>
                )}

                {reviews.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Este videojuego todavía no tiene reseñas.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {reviews.map((review) => (
                      <article
                        key={review.id_resena}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-bold text-slate-100">
                            {review.nombre_usuario}
                          </p>
                          <p className="text-sm font-black text-yellow-300">
                            {"★".repeat(review.calificacion)}
                            {"☆".repeat(5 - review.calificacion)}
                          </p>
                        </div>

                        <p className="mb-2 text-sm leading-6 text-slate-300">
                          {review.comentario}
                        </p>

                        <p className="text-xs text-slate-500">
                          {new Date(review.fecha_resena).toLocaleDateString(
                            "es-MX"
                          )}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          )}
        </section>
      )}

      {!loading && !connectionError && view === "cart" && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-6 text-4xl font-black">Carrito de compras</h2>

          {!profile && (
            <div className="mb-6 rounded-3xl border border-yellow-300/30 bg-yellow-400/10 p-5 text-yellow-100">
              Puedes agregar juegos al carrito, pero para finalizar la compra
              necesitas iniciar sesión.
            </div>
          )}

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

      {!loading &&
        !connectionError &&
        view === "admin" &&
        (profile?.rol === "admin" || profile?.rol === "desarrollador") && (
          <section className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8">
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                Acceso administrativo
              </p>
              <h2 className="text-4xl font-black">Panel de administrador</h2>
              <p className="mt-3 max-w-3xl text-slate-300">
                Desde aquí se agregan videojuegos directamente en PostgreSQL y
                se cargan archivos multimedia en Supabase Storage.
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
                      setNewGame({
                        ...newGame,
                        descripcion: event.target.value,
                      })
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
                      setNewGame({
                        ...newGame,
                        id_categoria: event.target.value,
                      })
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
                    placeholder="URL de imagen externa"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                  />

                  <label className="grid gap-2 rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-400/10 p-4 text-sm text-slate-200">
                    <span className="font-bold text-cyan-300">
                      Cargar imagen local JPG, PNG o GIF
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setImageFile(file);
                      }}
                      className="text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
                    />
                    {imageFile && (
                      <span className="text-xs text-slate-400">
                        Archivo seleccionado: {imageFile.name}
                      </span>
                    )}
                  </label>

                  <input
                    value={newGame.video_url}
                    onChange={(event) =>
                      setNewGame({ ...newGame, video_url: event.target.value })
                    }
                    placeholder="URL de video externo o embed de YouTube"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
                  />

                  <label className="grid gap-2 rounded-2xl border border-dashed border-purple-300/30 bg-purple-400/10 p-4 text-sm text-slate-200">
                    <span className="font-bold text-purple-300">
                      Cargar video local MP4
                    </span>
                    <input
                      type="file"
                      accept="video/mp4"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setVideoFile(file);
                      }}
                      className="text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-purple-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
                    />
                    {videoFile && (
                      <span className="text-xs text-slate-400">
                        Archivo seleccionado: {videoFile.name}
                      </span>
                    )}
                  </label>

                  <button
                    onClick={addNewGame}
                    disabled={uploadingMedia}
                    className="rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingMedia
                      ? "Guardando y subiendo archivos..."
                      : "Guardar videojuego en PostgreSQL"}
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
                          <td className="p-3">
                            ${Number(game.precio).toFixed(2)}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() =>
                                deactivateGame(game.id_videojuego)
                              }
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