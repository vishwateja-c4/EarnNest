import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "@/components/theme-provider"
import Layout from "./components/layout/Layout"
import Home from "./pages/Home"
import Login from "./pages/Login"
import Profile from "./pages/Profile"
import CreateTask from "./pages/CreateTask"
import TaskFeed from "./pages/TaskFeed"
import Chat from "./pages/Chat"
import Dashboard from "./pages/Dashboard"
import Wallet from "./pages/Wallet"
import NotFound from "./pages/NotFound"
import TaskDetails from "./pages/TaskDetails"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="tasks" element={<TaskFeed />} />
              <Route path="tasks/create" element={<CreateTask />} />
              <Route path="tasks/:id" element={<TaskDetails />} />
              <Route path="chat/:id/:receiverId" element={<Chat />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
