SELECT customer_id, guest_id, status, promoter_id, payment, id FROM public.order;


SELECT t1.customer_id AS customer_id, t1.guest_id AS guest_id, t1.status AS status, t1.deleted_at AS deleted_at, t2.username AS promoter_username_string, t1.id AS id, t1.payment AS payment FROM

(SELECT customer_id, guest_id, status, deleted_at, promoter_id, payment, id FROM public.order) t1,

(SELECT username, id FROM public.promoter) t2

WHERE 

t1.promoter_id = t2.id;