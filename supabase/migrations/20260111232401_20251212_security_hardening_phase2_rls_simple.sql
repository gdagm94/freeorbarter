/*
  # Database Security and Performance Hardening - Phase 2: RLS Optimization
  
  Optimizing RLS policies to use (SELECT auth.uid()) pattern.
*/

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create items" ON items;
CREATE POLICY "Users can create items"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own items" ON items;
CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own items" ON items;
CREATE POLICY "Users can delete own items"
  ON items FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update read status of received messages" ON messages;
CREATE POLICY "Users can update read status of received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their watched items" ON watched_items;
CREATE POLICY "Users can view their watched items"
  ON watched_items FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can add watched items" ON watched_items;
CREATE POLICY "Users can add watched items"
  ON watched_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can remove watched items" ON watched_items;
CREATE POLICY "Users can remove watched items"
  ON watched_items FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own notification settings" ON notification_settings;
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own notification settings" ON notification_settings;
CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notification settings" ON notification_settings;
CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notification settings" ON notification_settings;
CREATE POLICY "Users can delete their own notification settings"
  ON notification_settings FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their offers" ON barter_offers;
CREATE POLICY "Users can view their offers"
  ON barter_offers FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create offers" ON barter_offers;
CREATE POLICY "Users can create offers"
  ON barter_offers FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their offers" ON barter_offers;
CREATE POLICY "Users can update their offers"
  ON barter_offers FOR UPDATE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()))
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their blocks" ON blocked_users;
CREATE POLICY "Users can view their blocks"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;
CREATE POLICY "Users can create blocks"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can remove blocks" ON blocked_users;
CREATE POLICY "Users can remove blocks"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
CREATE POLICY "Users can view their own friend requests"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update received requests" ON friend_requests;
CREATE POLICY "Users can update received requests"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own pending requests" ON friend_requests;
CREATE POLICY "Users can delete their own pending requests"
  ON friend_requests FOR DELETE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their friendships" ON friendships;
CREATE POLICY "Users can view their friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their friendships" ON friendships;
CREATE POLICY "Users can delete their friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view reactions on their messages" ON message_reactions;
CREATE POLICY "Users can view reactions on their messages"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM messages WHERE messages.id = message_reactions.message_id AND (messages.sender_id = (SELECT auth.uid()) OR messages.receiver_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Users can add reactions to messages they can see" ON message_reactions;
CREATE POLICY "Users can add reactions to messages they can see"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM messages WHERE messages.id = message_reactions.message_id AND (messages.sender_id = (SELECT auth.uid()) OR messages.receiver_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view files in their messages" ON message_files;
CREATE POLICY "Users can view files in their messages"
  ON message_files FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM messages WHERE messages.id = message_files.message_id AND (messages.sender_id = (SELECT auth.uid()) OR messages.receiver_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Users can add files to their messages" ON message_files;
CREATE POLICY "Users can add files to their messages"
  ON message_files FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM messages WHERE messages.id = message_files.message_id AND messages.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can delete files from their messages" ON message_files;
CREATE POLICY "Users can delete files from their messages"
  ON message_files FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM messages WHERE messages.id = message_files.message_id AND messages.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view their own templates" ON offer_templates;
CREATE POLICY "Users can view their own templates"
  ON offer_templates FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own templates" ON offer_templates;
CREATE POLICY "Users can create their own templates"
  ON offer_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own templates" ON offer_templates;
CREATE POLICY "Users can update their own templates"
  ON offer_templates FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own templates" ON offer_templates;
CREATE POLICY "Users can delete their own templates"
  ON offer_templates FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own history" ON user_history;
CREATE POLICY "Users can view their own history"
  ON user_history FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own dismissals" ON changelog_dismissals;
CREATE POLICY "Users can view their own dismissals"
  ON changelog_dismissals FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create dismissals" ON changelog_dismissals;
CREATE POLICY "Users can create dismissals"
  ON changelog_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users select own policy acceptance" ON user_policy_acceptances;
CREATE POLICY "Users select own policy acceptance"
  ON user_policy_acceptances FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users insert their policy acceptance" ON user_policy_acceptances;
CREATE POLICY "Users insert their policy acceptance"
  ON user_policy_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their reports" ON reported_messages;
DROP POLICY IF EXISTS "Users can create reports" ON reported_messages;
CREATE POLICY "Users can view their message reports"
  ON reported_messages FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid()));

CREATE POLICY "Users can create message reports"
  ON reported_messages FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own filter logs" ON content_filter_logs;
CREATE POLICY "Users can view their own filter logs"
  ON content_filter_logs FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Moderators can view all filter logs" ON content_filter_logs;
CREATE POLICY "Moderators can view all filter logs"
  ON content_filter_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM moderation_actions WHERE moderation_actions.moderator_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS "Users can view expirations for their offers" ON offer_expirations;
CREATE POLICY "Users can view expirations for their offers"
  ON offer_expirations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = offer_expirations.offer_id AND barter_offers.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can create expirations for their offers" ON offer_expirations;
CREATE POLICY "Users can create expirations for their offers"
  ON offer_expirations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = offer_expirations.offer_id AND barter_offers.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update expirations for their offers" ON offer_expirations;
CREATE POLICY "Users can update expirations for their offers"
  ON offer_expirations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = offer_expirations.offer_id AND barter_offers.sender_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = offer_expirations.offer_id AND barter_offers.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view counter offers they're involved in" ON counter_offers;
CREATE POLICY "Users can view counter offers they're involved in"
  ON counter_offers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM barter_offers WHERE (barter_offers.id = counter_offers.original_offer_id OR barter_offers.id = counter_offers.counter_offer_id) AND (barter_offers.sender_id = (SELECT auth.uid()) OR barter_offers.receiver_id = (SELECT auth.uid()))));

DROP POLICY IF EXISTS "Users can create counter offers" ON counter_offers;
CREATE POLICY "Users can create counter offers"
  ON counter_offers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = counter_offers.counter_offer_id AND barter_offers.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update counter offers they created" ON counter_offers;
CREATE POLICY "Users can update counter offers they created"
  ON counter_offers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = counter_offers.counter_offer_id AND barter_offers.sender_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM barter_offers WHERE barter_offers.id = counter_offers.counter_offer_id AND barter_offers.sender_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Reporters can view their reports" ON reports;
DROP POLICY IF EXISTS "Moderators can view all reports" ON reports;
DROP POLICY IF EXISTS "Moderators can update reports" ON reports;

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

CREATE POLICY "Reporters can view their reports"
  ON reports FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid()));

CREATE POLICY "Moderators can view reports"
  ON reports FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM moderation_actions WHERE moderation_actions.moderator_id = (SELECT auth.uid()) LIMIT 1));

CREATE POLICY "Moderators can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM moderation_actions WHERE moderation_actions.moderator_id = (SELECT auth.uid()) LIMIT 1))
  WITH CHECK (EXISTS (SELECT 1 FROM moderation_actions WHERE moderation_actions.moderator_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS "Moderators can view all moderation actions" ON moderation_actions;
CREATE POLICY "Moderators can view all moderation actions"
  ON moderation_actions FOR SELECT
  TO authenticated
  USING (moderator_id = (SELECT auth.uid()));
