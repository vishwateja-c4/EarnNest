import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProfilePreview } from "@/components/ProfilePreview"
import { TaskRecommender } from "@/components/TaskRecommender"

interface Task {
    id: string
    title: string
    description: string
    category: string
    budget: number
    deadline: string
    required_skills: string[]
    priority_level: string
    status: string
    client_id: string
    profiles?: { full_name: string }
}

export default function TaskFeed() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [category, setCategory] = useState("all")
    const [maxBudget, setMaxBudget] = useState("")
    const [priority, setPriority] = useState("any")
    const [chatOpen, setChatOpen] = useState(false)

    const pruneExpired = (list: Task[]) => {
        const now = Date.now()
        return list.filter(task => task.status === "OPEN" && new Date(task.deadline).getTime() > now)
    }

    useEffect(() => {
        const fetchTasks = async () => {
            const nowIso = new Date().toISOString()
            const { data, error } = await supabase
                .from("tasks")
                .select("*, profiles:client_id(full_name)")
                .eq("status", "OPEN")
                .gt("deadline", nowIso)
                .order("created_at", { ascending: false })

            if (data) setTasks(pruneExpired(data))
            if (error) console.error("Error fetching tasks:", error)
            setLoading(false)
        }

        fetchTasks()
        const interval = setInterval(() => {
            setTasks(prev => pruneExpired(prev))
            fetchTasks()
        }, 5000) // 5s refresh for minute-level precision

        const channel = supabase.channel("tasks-feed")
            .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
                fetchTasks()
            })
            .subscribe()

        return () => {
            clearInterval(interval)
            supabase.removeChannel(channel)
        }
    }, [])

    const filteredTasks = pruneExpired(tasks).filter((task) => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.required_skills && task.required_skills.some((skill: string) => skill.toLowerCase().includes(searchTerm.toLowerCase())))
        const matchesCategory = category === "all" || task.category === category
        const matchesBudget = !maxBudget || task.budget <= parseInt(maxBudget)
        const matchesPriority = priority === "any" || task.priority_level === priority

        return matchesSearch && matchesCategory && matchesBudget && matchesPriority
    })

    return (
        <div className="container mx-auto py-8 px-4 flex flex-col md:flex-row gap-6">
            {/* Filters Sidebar */}
            <aside className="w-full md:w-64 md:shrink-0 space-y-6">
                <div className="bg-muted/30 p-4 border rounded-lg sticky top-24">
                    <h3 className="text-lg font-semibold mb-4">Filters</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Category</label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="coding">💻 Coding Help</SelectItem>
                                    <SelectItem value="design">🎨 Graphic Design</SelectItem>
                                    <SelectItem value="tutoring">📚 Tutoring / Doubt Session</SelectItem>
                                    <SelectItem value="notes">📝 Notes / Documentation</SelectItem>
                                    <SelectItem value="delivery">🏃 Delivery (Printouts/Food)</SelectItem>
                                    <SelectItem value="data">📊 Data Collection</SelectItem>
                                    <SelectItem value="event">🎉 Event Help</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Max Budget (₹)</label>
                            <Input
                                type="number"
                                placeholder="500"
                                value={maxBudget}
                                onChange={(e) => setMaxBudget(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Priority</label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger><SelectValue placeholder="Any Priority" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">Any Priority</SelectItem>
                                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                                    <SelectItem value="medium">🟡 Medium</SelectItem>
                                    <SelectItem value="low">⚪ Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Feed */}
            <main className="flex-1 space-y-6 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <Input
                        placeholder="Search tasks by title or skill tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:max-w-md bg-background"
                    />
                    <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
                        <Button onClick={() => setChatOpen(true)} variant="outline" className="w-full sm:w-auto">
                            🤖 AI Task Finder
                        </Button>
                        <Link to="/tasks/create" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto">Post a New Task</Button>
                        </Link>
                    </div>
                </div>

                <div className="grid gap-4">
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
                    ) : filteredTasks.map(task => (
                        <Card key={task.id} className="hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3 flex flex-row justify-between items-start gap-4">
                                <div>
                                    <CardTitle className="text-xl mb-1 leading-tight">{task.title}</CardTitle>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {task.required_skills?.map((tag: string) => (
                                            <Badge variant="secondary" key={tag}>{tag}</Badge>
                                        ))}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-2">
                                        <span>Posted by: {task.profiles?.full_name || "Unknown"}</span>
                                        {task.client_id && (
                                            <ProfilePreview
                                                userId={task.client_id}
                                                trigger={<Button variant="ghost" size="sm" className="h-8 px-2 ml-2">View profile</Button>}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-2xl font-bold text-green-600">₹{task.budget}</div>
                                    <Badge variant={task.priority_level === 'urgent' ? 'destructive' : 'outline'} className="mt-1 capitalize">
                                        {task.priority_level}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-4 text-sm text-muted-foreground flex flex-wrap justify-between gap-2 border-b">
                                <span>Category: <span className="capitalize text-foreground font-medium">{task.category}</span></span>
                                <span>Deadline: <span className="text-foreground font-medium">{new Date(task.deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span></span>
                            </CardContent>
                            <CardFooter className="pt-4 pb-4">
                                <Link to={`/tasks/${task.id}`} className="w-full">
                                    <Button variant="ghost" className="w-full border shadow-sm">View Details & Apply</Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                    {!loading && filteredTasks.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                            No tasks found. Try adjusting your filters.
                        </div>
                    )}
                </div>
            </main>

            <TaskRecommender tasks={tasks} open={chatOpen} onOpenChange={setChatOpen} />
        </div>
    )
}
