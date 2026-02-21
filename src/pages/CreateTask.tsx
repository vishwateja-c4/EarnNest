import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function CreateTask() {
    const { session } = useAuth()
    const navigate = useNavigate()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [category, setCategory] = useState("coding")
    const [priority, setPriority] = useState("medium")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!session?.user) {
            setError("You must be logged in to post a task.")
            return
        }

        setSaving(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const title = formData.get("title") as string
        const budget = parseFloat(formData.get("budget") as string)
        const deadlineInput = formData.get("deadline") as string
        const skillsRaw = formData.get("skills") as string
        const description = formData.get("description") as string

        const tags = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : []

        try {
            const { error: insertError } = await supabase.from("tasks").insert({
                client_id: session.user.id,
                title,
                description,
                category,
                budget,
                deadline: new Date(deadlineInput).toISOString(),
                required_skills: tags,
                priority_level: priority,
                status: 'OPEN'
            })

            if (insertError) throw insertError

            alert("Task posted successfully!")
            navigate("/tasks")
        } catch (err: any) {
            setError(err.message || "Failed to post task.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="container mx-auto py-10 px-4 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Create a New Task</CardTitle>
                    <CardDescription>Post a task on EarnNest to find campus freelancers to assist you.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

                        <div className="space-y-2">
                            <Label htmlFor="title">Task Title</Label>
                            <Input id="title" name="title" placeholder="e.g. Need urgent printouts from Lib..." required />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select required value={category} onValueChange={setCategory}>
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
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

                            <div className="space-y-2">
                                <Label htmlFor="budget">Budget (₹)</Label>
                                <Input id="budget" name="budget" type="number" placeholder="500" min="50" required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Priority Level</Label>
                            <RadioGroup value={priority} onValueChange={setPriority} className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="low" id="low" />
                                    <Label htmlFor="low" className="text-muted-foreground">Low</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="medium" id="medium" />
                                    <Label htmlFor="medium" className="text-primary">Medium</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="urgent" id="urgent" />
                                    <Label htmlFor="urgent" className="text-red-500 font-bold">Urgent</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deadline">Deadline</Label>
                            <Input id="deadline" name="deadline" type="datetime-local" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="skills">Required Skills (Tags)</Label>
                            <Input id="skills" name="skills" placeholder="e.g. Python, Math, Adobe Illustrator" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Detailed Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Explain exactly what needs to be done..."
                                className="h-32 resize-none"
                                required
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={saving}>
                            {saving ? "Posting Task..." : "Post Task to Marketplace"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
