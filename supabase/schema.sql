-- Database Schema for Campus Freelance Platform
-- Run this in your Supabase SQL Editor

-- 1. Profiles Table (Extended from auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  college_email TEXT NOT NULL UNIQUE,
  department TEXT,
  year_of_study TEXT,
  skills TEXT[] DEFAULT '{}',
  short_bio TEXT,
  reliability_score DECIMAL(3,2) DEFAULT 0.00,
  completed_tasks_count INTEGER DEFAULT 0,
  availability_status TEXT DEFAULT 'Busy', -- 'Free Now', 'Free for 1 Hour', 'Free Tonight', 'Free Weekends', 'Busy'
  status_expires_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Wallets Table (1-to-1 with Profiles)
CREATE TABLE public.wallets (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  available_balance DECIMAL(10,2) DEFAULT 0.00,
  locked_balance DECIMAL(10,2) DEFAULT 0.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
-- Updates to wallet should theoretically be handled by secure server functions, but allowing user for MVP
CREATE POLICY "Users can insert own wallet" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);

-- 3. Tasks Table
CREATE TABLE public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  priority_level TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'Urgent'
  status TEXT DEFAULT 'OPEN', -- 'OPEN', 'ASSIGNED', 'SUBMITTED', 'COMPLETED', 'CANCELLED'
  assigned_freelancer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks are viewable by everyone" ON tasks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their tasks" ON tasks FOR UPDATE USING (auth.uid() = client_id);
-- Also allow freelancers to update task status to 'SUBMITTED'
CREATE POLICY "Freelancers can update assigned tasks" ON tasks FOR UPDATE USING (auth.uid() = assigned_freelancer_id);

-- 4. Applications Table
CREATE TABLE public.applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  freelancer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pitch_message TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(task_id, freelancer_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own applications or apps for their tasks" ON applications FOR SELECT USING (
  auth.uid() = freelancer_id OR 
  auth.uid() IN (SELECT client_id FROM tasks WHERE tasks.id = applications.task_id)
);
CREATE POLICY "Freelancers can create applications" ON applications FOR INSERT WITH CHECK (auth.uid() = freelancer_id);
CREATE POLICY "Clients can update application status" ON applications FOR UPDATE USING (
  auth.uid() IN (SELECT client_id FROM tasks WHERE tasks.id = applications.task_id)
);

-- 5. Messages Table
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages they sent or received" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receivers can update message read status" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Set up Realtime for Messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
