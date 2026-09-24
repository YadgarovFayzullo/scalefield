import { redirect } from "next/navigation";

// Лендинга у панели нет: корень ведёт в дашборд (без сессии proxy отправит на /login).
export default function Home() {
  redirect("/dashboard");
}
