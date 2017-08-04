
SELECT 
	customer_id, 
	guest_id, 
	COUNT(DISTINCT order_id) AS num_orders,
	array_agg(distinct project_slug) AS project_slug_string,
	array_agg(distinct category_slug) AS category_slug_string
FROM
	(
		SELECT 
			t4.order_id AS order_id,
			t4.customer_id AS customer_id,
			t4.guest_id AS guest_id,
			t4.project_slug AS project_slug,
			t6.slug AS category_slug FROM
			(
			SELECT 
				t1.id AS order_id,
				t1.customer_id AS customer_id,
				t1.guest_id AS guest_id,
				t3.project_slug AS project_slug,
				t3.project_id AS project_id 
				FROM
				(
					(
						SELECT 
							id, 
							customer_id, 
							guest_id
						FROM 
							public.order
					) t1

					LEFT JOIN

					(
						SELECT 
							id, 
							guest_id 
						FROM 
							public.customer
					) t2 
					ON
						t2.guest_id = t1.guest_id 
					OR
						t2.id = t1.customer_id

					LEFT JOIN

					(
						SELECT project_slug, 
								project_id, 
								id 
						FROM 
							public.order_detail
					) t3
					ON
						t1.id = t3.id
				)
			) 
			t4

		LEFT JOIN
			(
				SELECT 
					category_id, 
					project_id 
				FROM
					public.project_to_category
			) 
			t5 
			ON 
			t4.project_id = t5.project_id

		LEFT JOIN
			(
				SELECT 
					slug, 
					id
				FROM 
					public.category
			) t6 
		ON 
			t5.category_id = t6.id
	) t_total
GROUP BY 
	customer_id, 
	guest_id
;







